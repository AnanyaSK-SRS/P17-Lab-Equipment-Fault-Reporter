"""
Flask REST API Entry Point for Lab Equipment Fault Reporter.

Uses Flask + Flask-Cors when installed, with automatic fallback to MicroFlask
in restricted Node-hosted preview containers so all Python modules and SQLite
logic execute natively in Python 3.
"""

from __future__ import annotations
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

BACKEND_DIR = str(Path(__file__).resolve().parent)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from flask import Flask, jsonify, request
    from flask_cors import CORS
    USING_REAL_FLASK = True
except ImportError:
    from flask_compat import MicroFlask as Flask, jsonify, request
    CORS = None
    USING_REAL_FLASK = False

from auth import create_access_token, decode_access_token, hash_password, verify_password
from classification import classify_report
from database import DEFAULT_DB_PATH, get_connection, init_db
from dispatch import (
    assign_report_to_handler,
    get_pending_queue,
    process_dispatch_queue,
    submit_and_dispatch_report,
    update_report_status,
)
from models import ROLES, SUPPORTED_DEPARTMENTS
from notifications import get_notifications, mark_notification_read, utc_now_iso
from tests.test_suite import run_test_suite_structured
from validation import validate_submission_identifiers

app = Flask(__name__)
if CORS is not None:
    CORS(app)

# Ensure SQLite DB & seed data exist on startup
init_db(os.environ.get("LAB_FAULT_DB_PATH", DEFAULT_DB_PATH), seed=True)


def get_current_user() -> Optional[Dict[str, Any]]:
    auth_header = ""
    for k, v in request.headers.items():
        if k.lower() == "authorization":
            auth_header = v
            break
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer "):].strip()
    return decode_access_token(token)


def require_auth(*allowed_roles: str):
    user = get_current_user()
    if not user:
        return None, (jsonify({"error": "Authentication required. Please log in."}), 401)
    if allowed_roles and user.get("role") not in allowed_roles:
        return None, (jsonify({"error": f"Forbidden: requires role {', '.join(allowed_roles)}."}), 403)
    return user, None


@app.route("/api/health", methods=["GET"])
def health():
    conn = get_connection()
    try:
        report_count = conn.execute("SELECT COUNT(*) FROM Reports").fetchone()[0]
    finally:
        conn.close()
    return jsonify({
        "status": "ok",
        "runtime": "flask" if USING_REAL_FLASK else "python-stdlib-wsgi",
        "database": "sqlite3",
        "reports_count": report_count,
    })


# -------------------- AUTHENTICATION --------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "reporter")).strip().lower()
    department = str(data.get("department", "ECE")).strip().upper()
    user_code = str(data.get("user_code", "")).strip()

    if not name or not email or len(password) < 6:
        return jsonify({"error": "Name, valid email, and password (min 6 characters) are required."}), 400
    if role not in ROLES:
        return jsonify({"error": f"Invalid role. Must be one of {ROLES}."}), 400
    if department not in SUPPORTED_DEPARTMENTS:
        department = "CENTRAL"

    conn = get_connection()
    try:
        existing = conn.execute("SELECT id FROM Users WHERE email = ?", (email,)).fetchone()
        if existing:
            return jsonify({"error": "An account with this email already exists."}), 409

        if not user_code:
            count = conn.execute("SELECT COUNT(*) FROM Users").fetchone()[0] + 101
            prefix = {"reporter": "USR", "handler": "HND", "admin": "ADM"}[role]
            user_code = f"{prefix}-{department}-{count}"

        ts = utc_now_iso()
        cur = conn.execute(
            """
            INSERT INTO Users (user_code, name, email, password_hash, role, department, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_code, name, email, hash_password(password), role, department, ts),
        )
        uid = cur.lastrowid

        # If registering as a maintenance handler, also provision a Handler profile row
        if role == "handler":
            team_row = conn.execute(
                "SELECT id FROM MaintenanceTeams WHERE department = ?",
                (department,),
            ).fetchone()
            if team_row:
                conn.execute(
                    """
                    INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload)
                    VALUES (?, ?, ?, ?, ?, ?, 1, 4, 0)
                    """,
                    (f"HND-{department}-{uid}", uid, name, department, team_row["id"], f"{department} Lab Equipment Maintenance"),
                )

        conn.commit()
        user_row = dict(conn.execute("SELECT id, user_code, name, email, role, department, created_at FROM Users WHERE id = ?", (uid,)).fetchone())
        token = create_access_token(user_row)
        return jsonify({"token": token, "user": user_row}), 201
    finally:
        conn.close()


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM Users WHERE LOWER(email) = ?", (email,)).fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            return jsonify({"error": "Invalid email or password."}), 401

        user_dict = {
            "id": row["id"],
            "user_code": row["user_code"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "department": row["department"],
            "created_at": row["created_at"],
        }
        token = create_access_token(user_dict)
        return jsonify({"token": token, "user": user_dict})
    finally:
        conn.close()


@app.route("/api/auth/me", methods=["GET"])
def me():
    user, err = require_auth()
    if err:
        return err
    return jsonify({"user": user})


# -------------------- VALIDATION & CLASSIFICATION LAB --------------------

@app.route("/api/validate", methods=["POST"])
def validate_identifiers():
    data = request.get_json(silent=True) or {}
    equipment_id = str(data.get("equipment_id", ""))
    fault_code = str(data.get("fault_code", ""))
    return jsonify(validate_submission_identifiers(equipment_id, fault_code))


@app.route("/api/classify", methods=["POST"])
def preview_classification():
    data = request.get_json(silent=True) or {}
    fault_code = str(data.get("fault_code", ""))
    fault_description = str(data.get("fault_description", ""))
    return jsonify(classify_report(fault_code, fault_description))


# -------------------- REPORTS & SUBMISSION --------------------

@app.route("/api/reports", methods=["POST"])
def create_report():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    conn = get_connection()
    try:
        res = submit_and_dispatch_report(
            conn,
            data,
            reporter_user_id=user["uid"] if user else None,
        )
        status_code = res.pop("status_code", 200)
        return jsonify(res), status_code
    finally:
        conn.close()


@app.route("/api/reports", methods=["GET"])
def list_reports():
    user = get_current_user()
    search = str(request.args.get("search", "")).strip()
    status = str(request.args.get("status", "")).strip()
    department = str(request.args.get("department", "")).strip().upper()
    category = str(request.args.get("category", "")).strip()
    scope = str(request.args.get("scope", "all")).strip().lower()

    clauses = []
    params = []

    if search:
        clauses.append("(r.report_id LIKE ? OR r.equipment_id LIKE ? OR r.lab_name LIKE ? OR r.reporter_name LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like, like, like])
    if department and department != "ALL":
        clauses.append("UPPER(r.department) = ?")
        params.append(department)
    if category and category != "All":
        clauses.append("r.detected_category = ?")
        params.append(category)

    if scope == "mine" and user:
        clauses.append("(r.reporter_user_id = ? OR LOWER(r.reporter_name) = LOWER(?))")
        params.extend([user["uid"], user["name"]])
    elif scope == "assigned" and user:
        clauses.append("h.user_id = ?")
        params.append(user["uid"])

    base_clauses = list(clauses)
    base_params = list(params)

    if status and status != "All":
        clauses.append("r.status = ?")
        params.append(status)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    base_where_sql = f"WHERE {' AND '.join(base_clauses)}" if base_clauses else ""
    conn = get_connection()
    try:
        rows = conn.execute(
            f"""
            SELECT r.*,
                   mt.team_name AS assigned_team_name,
                   mt.team_code AS assigned_team_code,
                   h.name AS assigned_handler_name,
                   h.handler_code AS assigned_handler_code
            FROM Reports r
            LEFT JOIN MaintenanceTeams mt ON mt.id = r.assigned_team_id
            LEFT JOIN Handlers h ON h.id = r.assigned_handler_id
            {where_sql}
            ORDER BY r.priority_rank ASC, r.created_at DESC, r.id DESC
            """,
            params,
        ).fetchall()

        reports = [dict(r) for r in rows]

        summary_rows = conn.execute(
            f"""
            SELECT r.status
            FROM Reports r
            LEFT JOIN Handlers h ON h.id = r.assigned_handler_id
            {base_where_sql}
            """,
            base_params,
        ).fetchall()

        summary = {
            "total": len(summary_rows),
            "pending": sum(1 for r in summary_rows if r["status"] == "Pending"),
            "assigned": sum(1 for r in summary_rows if r["status"] == "Assigned"),
            "in_progress": sum(1 for r in summary_rows if r["status"] == "In Progress"),
            "resolved": sum(1 for r in summary_rows if r["status"] == "Resolved"),
        }
        return jsonify({"reports": reports, "summary": summary})
    finally:
        conn.close()


@app.route("/api/reports/<report_id>", methods=["GET"])
def get_report_detail(report_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT r.*,
                   mt.team_name AS assigned_team_name,
                   mt.team_code AS assigned_team_code,
                   h.name AS assigned_handler_name,
                   h.handler_code AS assigned_handler_code
            FROM Reports r
            LEFT JOIN MaintenanceTeams mt ON mt.id = r.assigned_team_id
            LEFT JOIN Handlers h ON h.id = r.assigned_handler_id
            WHERE r.report_id = ?
            """,
            (report_id,),
        ).fetchone()
        if row is None:
            return jsonify({"error": f"Report {report_id} not found."}), 404

        history = [
            dict(r)
            for r in conn.execute(
                "SELECT * FROM StatusHistory WHERE report_id = ? ORDER BY id ASC",
                (report_id,),
            ).fetchall()
        ]
        assignments = [
            dict(r)
            for r in conn.execute(
                """
                SELECT a.*, h.name AS handler_name, mt.team_name
                FROM Assignments a
                LEFT JOIN Handlers h ON h.id = a.handler_id
                LEFT JOIN MaintenanceTeams mt ON mt.id = a.team_id
                WHERE a.report_id = ?
                ORDER BY a.id DESC
                """,
                (report_id,),
            ).fetchall()
        ]
        return jsonify({"report": dict(row), "status_history": history, "assignments": assignments})
    finally:
        conn.close()


@app.route("/api/reports/<report_id>/status", methods=["PATCH"])
def patch_report_status(report_id: str):
    user, err = require_auth("handler", "admin")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    new_status = str(data.get("status", "")).strip()
    notes = str(data.get("resolution_notes", "")).strip()
    conn = get_connection()
    try:
        result = update_report_status(
            conn,
            report_id=report_id,
            new_status=new_status,
            resolution_notes=notes,
            actor_user_id=user["uid"],
            actor_name=user["name"],
        )
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()


@app.route("/api/reports/<report_id>/reassign", methods=["POST"])
def reassign_report(report_id: str):
    user, err = require_auth("admin")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    handler_id = data.get("handler_id")
    notes = str(data.get("notes", "")).strip()
    if not handler_id:
        return jsonify({"error": "handler_id is required."}), 400

    conn = get_connection()
    try:
        handler = conn.execute("SELECT * FROM Handlers WHERE id = ?", (int(handler_id),)).fetchone()
        if not handler:
            return jsonify({"error": "Handler not found."}), 404
        report = conn.execute("SELECT * FROM Reports WHERE report_id = ?", (report_id,)).fetchone()
        if not report:
            return jsonify({"error": "Report not found."}), 404

        assigned = assign_report_to_handler(
            conn,
            report_id=report_id,
            handler_id=int(handler_id),
            team_id=handler["team_id"],
            assigned_by=f"ADMIN:{user['name']}",
            is_backup_assignment=bool(report["assigned_team_id"] and handler["team_id"] != report["assigned_team_id"]),
            priority_override=bool(report["priority_override"]),
            routing_decision="MANUAL_ADMIN_REASSIGNMENT",
            actor_user_id=user["uid"],
            actor_name=user["name"],
            notes=notes or f"Manually reassigned by administrator {user['name']} to {handler['name']}.",
        )
        conn.commit()
        return jsonify({"success": True, "assigned_handler": assigned})
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()


# -------------------- HANDLER MANAGEMENT --------------------

@app.route("/api/handlers", methods=["GET"])
def list_handlers():
    conn = get_connection()
    try:
        handlers = [
            dict(r)
            for r in conn.execute(
                """
                SELECT h.*, mt.team_name, mt.team_code, b.name AS backup_handler_name
                FROM Handlers h
                JOIN MaintenanceTeams mt ON mt.id = h.team_id
                LEFT JOIN Handlers b ON b.id = h.backup_handler_id
                ORDER BY h.department ASC, h.id ASC
                """
            ).fetchall()
        ]
        teams = [dict(r) for r in conn.execute("SELECT * FROM MaintenanceTeams ORDER BY id ASC").fetchall()]
        return jsonify({"handlers": handlers, "teams": teams})
    finally:
        conn.close()


@app.route("/api/handlers", methods=["POST"])
def create_handler():
    user, err = require_auth("admin")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    department = str(data.get("department", "ECE")).strip().upper()
    specialization = str(data.get("specialization", "")).strip() or "General Lab Equipment"
    max_capacity = int(data.get("max_capacity", 4) or 4)
    is_available = 1 if data.get("is_available", True) else 0
    backup_handler_id = data.get("backup_handler_id")

    if not name or department not in SUPPORTED_DEPARTMENTS:
        return jsonify({"error": "Handler name and valid department (ECE, MECH, CSE, CENTRAL) are required."}), 400
    if max_capacity < 1:
        return jsonify({"error": "Maximum capacity must be at least 1."}), 400

    conn = get_connection()
    try:
        team = conn.execute("SELECT id FROM MaintenanceTeams WHERE department = ?", (department,)).fetchone()
        if not team:
            return jsonify({"error": "Team not found for department."}), 404
        count = conn.execute("SELECT COUNT(*) FROM Handlers").fetchone()[0] + 1
        handler_code = f"HND-{department}-{count:02d}"
        cur = conn.execute(
            """
            INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload, backup_handler_id)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                handler_code,
                name,
                department,
                team["id"],
                specialization,
                is_available,
                max_capacity,
                int(backup_handler_id) if backup_handler_id else None,
            ),
        )
        conn.commit()
        dispatched = process_dispatch_queue(conn) if is_available else []
        created = dict(conn.execute("SELECT * FROM Handlers WHERE id = ?", (cur.lastrowid,)).fetchone())
        return jsonify({"handler": created, "dispatched_from_queue": dispatched}), 201
    finally:
        conn.close()


@app.route("/api/handlers/<int:handler_id>", methods=["PATCH"])
def update_handler(handler_id: int):
    user, err = require_auth("admin")
    if err:
        return err
    data = request.get_json(silent=True) or {}
    conn = get_connection()
    try:
        existing = conn.execute("SELECT * FROM Handlers WHERE id = ?", (int(handler_id),)).fetchone()
        if not existing:
            return jsonify({"error": "Handler not found."}), 404

        name = str(data.get("name", existing["name"])).strip()
        department = str(data.get("department", existing["department"])).strip().upper()
        specialization = str(data.get("specialization", existing["specialization"])).strip()
        is_available = 1 if data.get("is_available", bool(existing["is_available"])) else 0
        max_capacity = int(data.get("max_capacity", existing["max_capacity"]))
        backup_handler_id = data.get("backup_handler_id", existing["backup_handler_id"])

        team = conn.execute("SELECT id FROM MaintenanceTeams WHERE department = ?", (department,)).fetchone()
        team_id = team["id"] if team else existing["team_id"]

        if max_capacity < 1:
            return jsonify({"error": "max_capacity must be >= 1."}), 400

        conn.execute(
            """
            UPDATE Handlers
            SET name = ?, department = ?, team_id = ?, specialization = ?,
                is_available = ?, max_capacity = ?, backup_handler_id = ?
            WHERE id = ?
            """,
            (
                name,
                department,
                team_id,
                specialization,
                is_available,
                max_capacity,
                int(backup_handler_id) if backup_handler_id else None,
                int(handler_id),
            ),
        )
        conn.commit()
        dispatched = process_dispatch_queue(conn) if is_available else []
        updated = dict(
            conn.execute(
                """
                SELECT h.*, mt.team_name, b.name AS backup_handler_name
                FROM Handlers h
                JOIN MaintenanceTeams mt ON mt.id = h.team_id
                LEFT JOIN Handlers b ON b.id = h.backup_handler_id
                WHERE h.id = ?
                """,
                (int(handler_id),),
            ).fetchone()
        )
        return jsonify({"handler": updated, "dispatched_from_queue": dispatched})
    finally:
        conn.close()


# -------------------- ROUTING MANAGEMENT DASHBOARD --------------------

@app.route("/api/routing/overview", methods=["GET"])
def routing_overview():
    conn = get_connection()
    try:
        routing_table = [
            dict(r)
            for r in conn.execute(
                """
                SELECT rt.*, mt.team_name, mt.team_code, mt.safety_officer_email
                FROM RoutingTable rt
                JOIN MaintenanceTeams mt ON mt.id = rt.team_id
                ORDER BY rt.id ASC
                """
            ).fetchall()
        ]
        handlers = [
            dict(r)
            for r in conn.execute(
                """
                SELECT h.*, mt.team_name, b.name AS backup_handler_name
                FROM Handlers h
                JOIN MaintenanceTeams mt ON mt.id = h.team_id
                LEFT JOIN Handlers b ON b.id = h.backup_handler_id
                ORDER BY h.department ASC, h.id ASC
                """
            ).fetchall()
        ]
        queued_reports = get_pending_queue(conn)
        escalated_reports = [
            dict(r)
            for r in conn.execute(
                """
                SELECT r.*, mt.team_name, h.name AS assigned_handler_name
                FROM Reports r
                LEFT JOIN MaintenanceTeams mt ON mt.id = r.assigned_team_id
                LEFT JOIN Handlers h ON h.id = r.assigned_handler_id
                WHERE (r.priority_override = 1 OR r.detected_category = 'Safety') AND r.status != 'Resolved'
                ORDER BY r.priority_rank ASC, r.created_at DESC
                """
            ).fetchall()
        ]
        routing_history = [
            dict(r)
            for r in conn.execute(
                """
                SELECT a.*, h.name AS handler_name, mt.team_name, rep.department, rep.equipment_id, rep.priority_level
                FROM Assignments a
                LEFT JOIN Handlers h ON h.id = a.handler_id
                LEFT JOIN MaintenanceTeams mt ON mt.id = a.team_id
                LEFT JOIN Reports rep ON rep.report_id = a.report_id
                ORDER BY a.id DESC
                LIMIT 40
                """
            ).fetchall()
        ]
        return jsonify({
            "routing_table": routing_table,
            "handlers": handlers,
            "queued_reports": queued_reports,
            "escalated_reports": escalated_reports,
            "routing_history": routing_history,
        })
    finally:
        conn.close()


@app.route("/api/routing/process-queue", methods=["POST"])
def trigger_queue_dispatch():
    user, err = require_auth("admin")
    if err:
        return err
    conn = get_connection()
    try:
        dispatched = process_dispatch_queue(conn)
        return jsonify({"dispatched": dispatched, "count": len(dispatched)})
    finally:
        conn.close()


# -------------------- ANALYTICS (REAL SQLITE DATA) --------------------

@app.route("/api/analytics", methods=["GET"])
def analytics():
    department = str(request.args.get("department", "")).strip().upper()
    category = str(request.args.get("category", "")).strip()
    start_date = str(request.args.get("start_date", "")).strip()
    end_date = str(request.args.get("end_date", "")).strip()

    clauses = []
    params = []

    if department and department != "ALL":
        clauses.append("UPPER(department) = ?")
        params.append(department)
    if category and category != "ALL":
        clauses.append("detected_category = ?")
        params.append(category)
    if start_date:
        clauses.append("substr(created_at, 1, 10) >= ?")
        params.append(start_date)
    if end_date:
        clauses.append("substr(created_at, 1, 10) <= ?")
        params.append(end_date)

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    conn = get_connection()
    try:
        total = conn.execute(f"SELECT COUNT(*) FROM Reports {where_sql}", params).fetchone()[0]
        resolved_count = conn.execute(
            f"SELECT COUNT(*) FROM Reports {where_sql} {'AND' if where_sql else 'WHERE'} status = 'Resolved'",
            params,
        ).fetchone()[0]
        unresolved_count = total - resolved_count

        by_category = [
            dict(r)
            for r in conn.execute(
                f"SELECT detected_category AS label, COUNT(*) AS count FROM Reports {where_sql} GROUP BY detected_category ORDER BY count DESC",
                params,
            ).fetchall()
        ]
        by_department = [
            dict(r)
            for r in conn.execute(
                f"SELECT department AS label, COUNT(*) AS count FROM Reports {where_sql} GROUP BY department ORDER BY count DESC",
                params,
            ).fetchall()
        ]
        by_zone = [
            dict(r)
            for r in conn.execute(
                f"SELECT routing_zone AS label, COUNT(*) AS count FROM Reports {where_sql} GROUP BY routing_zone ORDER BY count DESC",
                params,
            ).fetchall()
        ]
        by_priority = [
            dict(r)
            for r in conn.execute(
                f"SELECT priority_level AS label, COUNT(*) AS count FROM Reports {where_sql} GROUP BY priority_level ORDER BY priority_rank ASC",
                params,
            ).fetchall()
        ]
        by_month = [
            dict(r)
            for r in conn.execute(
                f"SELECT substr(created_at, 1, 7) AS label, COUNT(*) AS count FROM Reports {where_sql} GROUP BY substr(created_at, 1, 7) ORDER BY label ASC",
                params,
            ).fetchall()
        ]

        return jsonify({
            "totals": {
                "total": total,
                "resolved": resolved_count,
                "unresolved": unresolved_count,
            },
            "by_category": by_category,
            "by_department": by_department,
            "by_zone": by_zone,
            "by_priority": by_priority,
            "by_month": by_month,
        })
    finally:
        conn.close()


# -------------------- NOTIFICATIONS --------------------

@app.route("/api/notifications", methods=["GET"])
def list_notifications():
    user = get_current_user()
    role = user["role"] if user else "all"
    unread_only = str(request.args.get("unread_only", "false")).lower() == "true"
    conn = get_connection()
    try:
        items = get_notifications(conn, role=role, unread_only=unread_only)
        unread_count = sum(1 for item in items if not item["is_read"])
        return jsonify({"notifications": items, "unread_count": unread_count})
    finally:
        conn.close()


@app.route("/api/notifications/<int:notification_id>/read", methods=["PATCH"])
def read_notification(notification_id: int):
    conn = get_connection()
    try:
        ok = mark_notification_read(conn, int(notification_id))
        return jsonify({"success": ok})
    finally:
        conn.close()


# -------------------- TEST SUITE EXECUTION --------------------

@app.route("/api/tests/run", methods=["GET", "POST"])
def execute_tests():
    return jsonify(run_test_suite_structured())


if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_API_PORT", "5001"))
    app.run(host="127.0.0.1", port=port, debug=False)
