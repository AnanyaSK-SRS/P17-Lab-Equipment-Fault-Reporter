"""
Dispatch, Handler Assignment, Priority Scheduling, Queue Management, and Status Lifecycle Engine.
"""

from __future__ import annotations
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from models import REPORT_STATUSES
from notifications import create_notification, notify_safety_officer, utc_now_iso
from routing import route_validated_report
from validation import validate_submission_identifiers
from classification import classify_report


def generate_report_id(conn: sqlite3.Connection) -> str:
    now = datetime.now(timezone.utc)
    prefix = f"RPT-{now.strftime('%Y%m')}"
    rows = conn.execute(
        "SELECT report_id FROM Reports WHERE report_id LIKE ?",
        (f"{prefix}-%",),
    ).fetchall()
    max_seq = 0
    for r in rows:
        try:
            seq = int(r["report_id"].split("-")[-1])
            if seq > max_seq:
                max_seq = seq
        except Exception:
            continue
    return f"{prefix}-{max_seq + 1:03d}"


def select_eligible_handler(
    conn: sqlite3.Connection,
    *,
    team_id: int,
) -> Dict[str, Any]:
    """
    Select an available handler with remaining capacity:
    1. Primary team handlers ordered by lowest current_workload, then handler_id.
    2. Designated backup handlers (or cross-team available backup handlers) if primary team is unavailable/full.
    """
    primary_handler = conn.execute(
        """
        SELECT h.*, mt.team_name
        FROM Handlers h
        JOIN MaintenanceTeams mt ON mt.id = h.team_id
        WHERE h.team_id = ?
          AND h.is_available = 1
          AND h.current_workload < h.max_capacity
        ORDER BY h.current_workload ASC, h.id ASC
        LIMIT 1
        """,
        (team_id,),
    ).fetchone()

    if primary_handler is not None:
        return {
            "found": True,
            "handler": dict(primary_handler),
            "is_backup": False,
            "reason": "Assigned to primary team handler with lowest workload.",
        }

    # Check designated backup_handler_id linked to handlers of this team
    backup_handler = conn.execute(
        """
        SELECT b.*, mt.team_name
        FROM Handlers primary_h
        JOIN Handlers b ON b.id = primary_h.backup_handler_id
        JOIN MaintenanceTeams mt ON mt.id = b.team_id
        WHERE primary_h.team_id = ?
          AND b.is_available = 1
          AND b.current_workload < b.max_capacity
        ORDER BY b.current_workload ASC, b.id ASC
        LIMIT 1
        """,
        (team_id,),
    ).fetchone()

    if backup_handler is not None:
        return {
            "found": True,
            "handler": dict(backup_handler),
            "is_backup": True,
            "reason": "Primary team unavailable or at capacity; dispatched to designated backup handler.",
        }

    # Check Central Stores backup pool if primary team wasn't already Central
    central_backup = conn.execute(
        """
        SELECT h.*, mt.team_name
        FROM Handlers h
        JOIN MaintenanceTeams mt ON mt.id = h.team_id
        WHERE UPPER(mt.department) = 'CENTRAL'
          AND h.team_id != ?
          AND h.is_available = 1
          AND h.current_workload < h.max_capacity
        ORDER BY h.current_workload ASC, h.id ASC
        LIMIT 1
        """,
        (team_id,),
    ).fetchone()

    if central_backup is not None:
        return {
            "found": True,
            "handler": dict(central_backup),
            "is_backup": True,
            "reason": "Primary team unavailable or at capacity; dispatched to Central Stores backup handler.",
        }

    # Determine whether handlers exist but are full vs unavailable
    team_handlers = conn.execute(
        "SELECT is_available, current_workload, max_capacity FROM Handlers WHERE team_id = ?",
        (team_id,),
    ).fetchall()
    if team_handlers and any(h["is_available"] == 1 and h["current_workload"] >= h["max_capacity"] for h in team_handlers):
        queue_reason = "QUEUED_CAPACITY_EXCEEDED"
    else:
        queue_reason = "QUEUED_NO_AVAILABLE_HANDLER"

    return {
        "found": False,
        "handler": None,
        "is_backup": False,
        "reason": queue_reason,
    }


def assign_report_to_handler(
    conn: sqlite3.Connection,
    *,
    report_id: str,
    handler_id: int,
    team_id: int,
    assigned_by: str,
    is_backup_assignment: bool,
    priority_override: bool,
    routing_decision: str,
    actor_user_id: Optional[int] = None,
    actor_name: str = "Auto-Dispatch Engine",
    notes: str = "",
) -> Dict[str, Any]:
    """
    Assign a report to a handler while preventing duplicate active assignments
    and keeping handler workload synchronized.
    """
    existing_active = conn.execute(
        "SELECT id, handler_id FROM Assignments WHERE report_id = ? AND active = 1",
        (report_id,),
    ).fetchone()

    if existing_active is not None:
        if existing_active["handler_id"] == handler_id:
            raise ValueError(f"Duplicate assignment prevented: {report_id} is already assigned to handler #{handler_id}.")
        # Deactivate old assignment on manual reassignment and decrement previous handler's workload
        conn.execute("UPDATE Assignments SET active = 0 WHERE id = ?", (existing_active["id"],))
        if existing_active["handler_id"] is not None:
            conn.execute(
                "UPDATE Handlers SET current_workload = MAX(0, current_workload - 1) WHERE id = ?",
                (existing_active["handler_id"],),
            )

    handler_row = conn.execute("SELECT * FROM Handlers WHERE id = ?", (handler_id,)).fetchone()
    if handler_row is None:
        raise ValueError(f"Handler #{handler_id} not found.")
    if not handler_row["is_available"]:
        raise ValueError(f"Handler {handler_row['name']} is currently unavailable.")
    if handler_row["current_workload"] >= handler_row["max_capacity"]:
        raise ValueError(f"Handler {handler_row['name']} has reached maximum capacity ({handler_row['max_capacity']}).")

    report_row = conn.execute("SELECT status FROM Reports WHERE report_id = ?", (report_id,)).fetchone()
    old_status = report_row["status"] if report_row else "Pending"
    ts = utc_now_iso()

    conn.execute(
        """
        INSERT INTO Assignments (
            report_id, handler_id, team_id, assigned_by,
            is_backup_assignment, priority_override, routing_decision, assigned_at, active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
        (
            report_id,
            handler_id,
            team_id,
            assigned_by,
            1 if is_backup_assignment else 0,
            1 if priority_override else 0,
            routing_decision,
            ts,
        ),
    )

    conn.execute(
        "UPDATE Handlers SET current_workload = current_workload + 1 WHERE id = ?",
        (handler_id,),
    )

    new_status = "Assigned" if old_status in ("Pending", "Assigned") else old_status
    conn.execute(
        """
        UPDATE Reports
        SET assigned_team_id = ?,
            assigned_handler_id = ?,
            routing_decision = ?,
            status = ?,
            updated_at = ?
        WHERE report_id = ?
        """,
        (team_id, handler_id, routing_decision, new_status, ts, report_id),
    )

    conn.execute(
        """
        INSERT INTO StatusHistory (report_id, old_status, new_status, changed_by_user_id, changed_by_name, notes, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            report_id,
            old_status,
            new_status,
            actor_user_id,
            actor_name,
            notes or f"Assigned to {handler_row['name']} ({routing_decision}).",
            ts,
        ),
    )

    create_notification(
        conn,
        report_id=report_id,
        recipient_role="handler",
        recipient_name=handler_row["name"],
        notification_type="ASSIGNMENT_ALERT",
        severity="high" if priority_override else "info",
        title=f"Assigned Report {report_id}",
        message=f"You have been assigned report {report_id} ({routing_decision}).",
        created_at=ts,
    )

    return dict(handler_row)


def submit_and_dispatch_report(
    conn: sqlite3.Connection,
    payload: Dict[str, Any],
    *,
    reporter_user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Full end-to-end report pipeline:
    1. Validate required fields
    2. DFA validation
    3. Regex validation
    4. Agreement verification
    5. Automatic classification
    6. Priority determination
    7. Routing table lookup
    8. Handler assignment or deterministic queue placement
    9. Generate unique Report ID
    10. Persist to SQLite + emit notifications
    """
    required_fields = [
        "reporter_name",
        "reporter_id_code",
        "department",
        "lab_name",
        "equipment_id",
        "fault_code",
        "fault_description",
        "urgency",
    ]
    missing = [f for f in required_fields if not str(payload.get(f, "")).strip()]
    if missing:
        return {
            "success": False,
            "status_code": 400,
            "error": f"Missing required fields: {', '.join(missing)}.",
            "missing_fields": missing,
        }

    equipment_id = str(payload["equipment_id"]).strip()
    fault_code = str(payload["fault_code"]).strip()
    department = str(payload["department"]).strip().upper()
    lab_name = str(payload["lab_name"]).strip()
    routing_zone = str(payload.get("routing_zone") or "DEFAULT").strip()
    fault_description = str(payload["fault_description"]).strip()
    urgency = str(payload["urgency"]).strip()
    reported_at = str(payload.get("reported_at") or utc_now_iso()).strip()

    # Step 2-4: DFA & Regex validation
    validation = validate_submission_identifiers(equipment_id, fault_code)
    if not validation["valid"]:
        return {
            "success": False,
            "status_code": 422,
            "error": "; ".join(validation["errors"]) or "Equipment ID or Fault Code failed DFA/Regex validation.",
            "validation": validation,
        }

    # Step 5: Automatic classification
    classification = classify_report(fault_code, fault_description)

    # Step 6-7: Priority & Routing
    routing = route_validated_report(
        conn,
        department=department,
        routing_zone=routing_zone,
        dfa_valid=validation["dfa_valid"],
        regex_valid=validation["regex_valid"],
        urgency=urgency,
        detected_category=classification["category"],
    )

    # Step 8: Generate unique Report ID & select handler
    report_id = generate_report_id(conn)
    ts = utc_now_iso()

    handler_selection = select_eligible_handler(conn, team_id=routing["team_id"])
    assigned_handler = handler_selection["handler"]

    if routing["is_fallback"]:
        final_routing_decision = "FALLBACK_CORRECTION_QUEUE"
    elif assigned_handler is None:
        final_routing_decision = handler_selection["reason"]
    elif handler_selection["is_backup"]:
        final_routing_decision = "BACKUP_HANDLER_ASSIGNED"
    elif routing["priority_override"]:
        final_routing_decision = "PRIORITY_OVERRIDE_PRIMARY_TEAM"
    else:
        final_routing_decision = "ROUTED_PRIMARY_TEAM"

    initial_status = "Assigned" if assigned_handler is not None else "Pending"

    conn.execute(
        """
        INSERT INTO Reports (
            report_id, reporter_user_id, reporter_name, reporter_id_code, department, lab_name,
            routing_zone, equipment_id, fault_code, fault_description, urgency, reported_at,
            dfa_valid, dfa_trace, regex_valid, validation_agreement,
            detected_category, classification_reason, classification_confidence,
            priority_level, priority_rank, priority_override, routing_decision,
            assigned_team_id, assigned_handler_id, status, resolution_notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
        """,
        (
            report_id,
            reporter_user_id,
            str(payload["reporter_name"]).strip(),
            str(payload["reporter_id_code"]).strip(),
            department,
            lab_name,
            routing["zone"],
            equipment_id,
            fault_code,
            fault_description,
            routing["priority_level"],
            reported_at,
            1 if validation["dfa_valid"] else 0,
            json.dumps(validation["equipment_id"]["dfa"]["transitions"]),
            1 if validation["regex_valid"] else 0,
            1 if validation["agreement"] else 0,
            classification["category"],
            classification["reason"],
            classification["confidence"],
            routing["priority_level"],
            routing["priority_rank"],
            1 if routing["priority_override"] else 0,
            final_routing_decision,
            routing["team_id"],
            assigned_handler["id"] if assigned_handler else None,
            initial_status,
            ts,
            ts,
        ),
    )

    conn.execute(
        """
        INSERT INTO StatusHistory (report_id, old_status, new_status, changed_by_user_id, changed_by_name, notes, changed_at)
        VALUES (?, NULL, 'Pending', ?, ?, ?, ?)
        """,
        (
            report_id,
            reporter_user_id,
            str(payload["reporter_name"]).strip(),
            f"Submitted and validated (DFA & Regex agree). Classified as {classification['category']}.",
            ts,
        ),
    )

    if assigned_handler is not None:
        assign_report_to_handler(
            conn,
            report_id=report_id,
            handler_id=assigned_handler["id"],
            team_id=routing["team_id"],
            assigned_by="AUTO_DISPATCH",
            is_backup_assignment=handler_selection["is_backup"],
            priority_override=routing["priority_override"],
            routing_decision=final_routing_decision,
            actor_user_id=None,
            actor_name="Auto-Dispatch Engine",
            notes=handler_selection["reason"],
        )
    else:
        create_notification(
            conn,
            report_id=report_id,
            recipient_role="admin",
            recipient_name="Maintenance Administrator",
            notification_type="QUEUE_ALERT",
            severity="warning",
            title=f"Report Queued: {report_id} ({final_routing_decision})",
            message=f"Report {report_id} for {routing['team_name']} placed in priority queue ({routing['priority_level']}).",
            created_at=ts,
        )

    # Mandatory Safety Rule: notify Lab Safety Officer immediately
    safety_notified = False
    if classification["category"] == "Safety":
        notify_safety_officer(
            conn,
            report_id=report_id,
            equipment_id=equipment_id,
            department=department,
            lab_name=lab_name,
            team_name=routing["team_name"],
            fault_description=fault_description,
        )
        safety_notified = True

    if routing["priority_override"]:
        create_notification(
            conn,
            report_id=report_id,
            recipient_role="admin",
            recipient_name="Maintenance Administrator",
            notification_type="EMERGENCY_ESCALATION",
            severity="critical",
            title=f"Emergency Priority Override: {report_id}",
            message=f"Emergency/Critical report {report_id} ({equipment_id}) prioritized for {routing['team_name']}.",
            created_at=ts,
        )

    conn.commit()

    queue_position = None
    if assigned_handler is None:
        queue_position = get_queue_position(conn, report_id)

    return {
        "success": True,
        "status_code": 201,
        "report_id": report_id,
        "validation": validation,
        "classification": classification,
        "routing": {
            "team_id": routing["team_id"],
            "team_name": routing["team_name"],
            "team_code": routing["team_code"],
            "routing_decision": final_routing_decision,
            "is_fallback": routing["is_fallback"],
            "priority_level": routing["priority_level"],
            "priority_rank": routing["priority_rank"],
            "priority_override": routing["priority_override"],
            "safety_notified": safety_notified,
        },
        "assignment": {
            "status": initial_status,
            "assigned_handler_id": assigned_handler["id"] if assigned_handler else None,
            "assigned_handler_name": assigned_handler["name"] if assigned_handler else None,
            "assigned_handler_code": assigned_handler["handler_code"] if assigned_handler else None,
            "is_backup_assignment": handler_selection["is_backup"],
            "queue_position": queue_position,
        },
    }


def get_pending_queue(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Deterministic priority queue ordering: priority_rank ASC, created_at ASC, report_id ASC."""
    rows = conn.execute(
        """
        SELECT r.*, mt.team_name
        FROM Reports r
        LEFT JOIN MaintenanceTeams mt ON mt.id = r.assigned_team_id
        WHERE r.status = 'Pending' AND r.assigned_handler_id IS NULL
        ORDER BY r.priority_rank ASC, r.created_at ASC, r.report_id ASC
        """
    ).fetchall()
    return [dict(r) for r in rows]


def get_queue_position(conn: sqlite3.Connection, report_id: str) -> Optional[int]:
    queue = get_pending_queue(conn)
    for idx, item in enumerate(queue, start=1):
        if item["report_id"] == report_id:
            return idx
    return None


def process_dispatch_queue(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """Attempt to dispatch queued Pending reports in deterministic priority order."""
    dispatched: List[Dict[str, Any]] = []
    for item in get_pending_queue(conn):
        if not item.get("assigned_team_id"):
            continue
        sel = select_eligible_handler(conn, team_id=item["assigned_team_id"])
        if not sel["found"] or sel["handler"] is None:
            continue
        decision = "BACKUP_HANDLER_ASSIGNED" if sel["is_backup"] else (
            "PRIORITY_OVERRIDE_PRIMARY_TEAM" if item["priority_override"] else "DISPATCHED_FROM_QUEUE"
        )
        assign_report_to_handler(
            conn,
            report_id=item["report_id"],
            handler_id=sel["handler"]["id"],
            team_id=item["assigned_team_id"],
            assigned_by="QUEUE_SCHEDULER",
            is_backup_assignment=sel["is_backup"],
            priority_override=bool(item["priority_override"]),
            routing_decision=decision,
            actor_name="Queue Scheduler",
            notes=f"Auto-dispatched from queue to {sel['handler']['name']}.",
        )
        dispatched.append({"report_id": item["report_id"], "handler_name": sel["handler"]["name"]})
    conn.commit()
    return dispatched


def update_report_status(
    conn: sqlite3.Connection,
    *,
    report_id: str,
    new_status: str,
    resolution_notes: str = "",
    actor_user_id: Optional[int] = None,
    actor_name: str = "Handler",
) -> Dict[str, Any]:
    if new_status not in REPORT_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of {REPORT_STATUSES}.")

    report = conn.execute("SELECT * FROM Reports WHERE report_id = ?", (report_id,)).fetchone()
    if report is None:
        raise ValueError(f"Report {report_id} not found.")

    old_status = report["status"]
    ts = utc_now_iso()

    combined_notes = resolution_notes.strip() or report["resolution_notes"] or ""
    conn.execute(
        """
        UPDATE Reports
        SET status = ?,
            resolution_notes = ?,
            updated_at = ?
        WHERE report_id = ?
        """,
        (new_status, combined_notes, ts, report_id),
    )

    conn.execute(
        """
        INSERT INTO StatusHistory (report_id, old_status, new_status, changed_by_user_id, changed_by_name, notes, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (report_id, old_status, new_status, actor_user_id, actor_name, combined_notes or f"Status changed to {new_status}.", ts),
    )

    # Free handler capacity when report transitions from active -> Resolved
    if new_status == "Resolved" and old_status != "Resolved":
        active_assignments = conn.execute(
            "SELECT id, handler_id FROM Assignments WHERE report_id = ? AND active = 1",
            (report_id,),
        ).fetchall()
        for a in active_assignments:
            conn.execute("UPDATE Assignments SET active = 0 WHERE id = ?", (a["id"],))
            if a["handler_id"] is not None:
                conn.execute(
                    "UPDATE Handlers SET current_workload = MAX(0, current_workload - 1) WHERE id = ?",
                    (a["handler_id"],),
                )

    create_notification(
        conn,
        report_id=report_id,
        recipient_role="reporter",
        recipient_name=report["reporter_name"],
        notification_type="STATUS_UPDATE",
        severity="info",
        title=f"Report {report_id} marked {new_status}",
        message=f"Status updated from {old_status} to {new_status} by {actor_name}.",
        created_at=ts,
    )

    conn.commit()

    # Automatically attempt to dispatch queued reports when capacity is released
    newly_dispatched = []
    if new_status == "Resolved" and old_status != "Resolved":
        newly_dispatched = process_dispatch_queue(conn)

    updated = conn.execute("SELECT * FROM Reports WHERE report_id = ?", (report_id,)).fetchone()
    return {
        "report": dict(updated),
        "dispatched_from_queue": newly_dispatched,
    }
