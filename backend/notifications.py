"""
Notification service for persisting Safety Officer alerts, emergency escalations,
handler assignments, queue placements, and status change notices in SQLite.
"""

from __future__ import annotations
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def create_notification(
    conn: sqlite3.Connection,
    *,
    report_id: Optional[str],
    recipient_role: str,
    recipient_name: str,
    notification_type: str,
    severity: str,
    title: str,
    message: str,
    created_at: Optional[str] = None,
) -> int:
    ts = created_at or utc_now_iso()
    cur = conn.execute(
        """
        INSERT INTO Notifications (
            report_id, recipient_role, recipient_name,
            notification_type, severity, title, message, is_read, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (report_id, recipient_role, recipient_name, notification_type, severity, title, message, ts),
    )
    return int(cur.lastrowid)


def notify_safety_officer(
    conn: sqlite3.Connection,
    *,
    report_id: str,
    equipment_id: str,
    department: str,
    lab_name: str,
    team_name: str,
    fault_description: str,
) -> int:
    return create_notification(
        conn,
        report_id=report_id,
        recipient_role="safety_officer",
        recipient_name=f"Lab Safety Officer ({department})",
        notification_type="SAFETY_OFFICER_ALERT",
        severity="critical",
        title=f"Safety Hazard Reported: {equipment_id} in {lab_name}",
        message=(
            f"Immediate safety inspection required for {equipment_id} ({department} / {lab_name}). "
            f"Assigned team: {team_name}. Fault summary: {fault_description[:160]}"
        ),
    )


def get_notifications(
    conn: sqlite3.Connection,
    *,
    role: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    clauses = []
    params: List[Any] = []

    if role == "reporter":
        clauses.append("recipient_role IN ('reporter', 'all')")
    elif role == "handler":
        clauses.append("recipient_role IN ('handler', 'safety_officer', 'all')")
    elif role == "admin":
        pass  # Admin sees all system notifications including Safety Officer alerts

    if unread_only:
        clauses.append("is_read = 0")

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"""
        SELECT * FROM Notifications
        {where_sql}
        ORDER BY id DESC
        LIMIT ?
        """,
        (*params, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def mark_notification_read(conn: sqlite3.Connection, notification_id: int) -> bool:
    cur = conn.execute("UPDATE Notifications SET is_read = 1 WHERE id = ?", (notification_id,))
    conn.commit()
    return cur.rowcount > 0
