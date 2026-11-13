"""
SQLite Database Schema, Connection Manager, and Realistic Seed Data.

Tables:
    1. Users
    2. MaintenanceTeams
    3. Handlers
    4. RoutingTable
    5. Reports
    6. Assignments
    7. StatusHistory
    8. Notifications
"""

from __future__ import annotations
import json
import os
import sqlite3
from pathlib import Path
from typing import Optional

from auth import hash_password
from models import TEAM_DIRECTORY

DEFAULT_DB_PATH = str(Path(__file__).resolve().parent / "lab_fault_reporter.db")


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or os.environ.get("LAB_FAULT_DB_PATH", DEFAULT_DB_PATH)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('reporter', 'handler', 'admin')),
    department TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS MaintenanceTeams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_code TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    safety_officer_email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Handlers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    handler_code TEXT NOT NULL UNIQUE,
    user_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    team_id INTEGER NOT NULL REFERENCES MaintenanceTeams(id) ON DELETE CASCADE,
    specialization TEXT NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1,
    max_capacity INTEGER NOT NULL DEFAULT 4 CHECK(max_capacity >= 1),
    current_workload INTEGER NOT NULL DEFAULT 0 CHECK(current_workload >= 0),
    backup_handler_id INTEGER REFERENCES Handlers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS RoutingTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routing_key TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    zone TEXT NOT NULL,
    team_id INTEGER NOT NULL REFERENCES MaintenanceTeams(id) ON DELETE CASCADE,
    priority_weight INTEGER NOT NULL DEFAULT 1,
    is_fallback INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL UNIQUE,
    reporter_user_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
    reporter_name TEXT NOT NULL,
    reporter_id_code TEXT NOT NULL,
    department TEXT NOT NULL,
    lab_name TEXT NOT NULL,
    routing_zone TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    fault_code TEXT NOT NULL,
    fault_description TEXT NOT NULL,
    urgency TEXT NOT NULL CHECK(urgency IN ('Emergency/Critical', 'High', 'Medium', 'Low')),
    reported_at TEXT NOT NULL,
    dfa_valid INTEGER NOT NULL,
    dfa_trace TEXT NOT NULL,
    regex_valid INTEGER NOT NULL,
    validation_agreement INTEGER NOT NULL,
    detected_category TEXT NOT NULL CHECK(detected_category IN ('Hardware', 'Calibration', 'Software', 'Safety', 'Consumable')),
    classification_reason TEXT NOT NULL,
    classification_confidence TEXT NOT NULL,
    priority_level TEXT NOT NULL,
    priority_rank INTEGER NOT NULL,
    priority_override INTEGER NOT NULL DEFAULT 0,
    routing_decision TEXT NOT NULL,
    assigned_team_id INTEGER REFERENCES MaintenanceTeams(id) ON DELETE SET NULL,
    assigned_handler_id INTEGER REFERENCES Handlers(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending', 'Assigned', 'In Progress', 'Resolved')),
    resolution_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL REFERENCES Reports(report_id) ON DELETE CASCADE,
    handler_id INTEGER REFERENCES Handlers(id) ON DELETE SET NULL,
    team_id INTEGER NOT NULL REFERENCES MaintenanceTeams(id) ON DELETE CASCADE,
    assigned_by TEXT NOT NULL,
    is_backup_assignment INTEGER NOT NULL DEFAULT 0,
    priority_override INTEGER NOT NULL DEFAULT 0,
    routing_decision TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS StatusHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL REFERENCES Reports(report_id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_user_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
    changed_by_name TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT REFERENCES Reports(report_id) ON DELETE CASCADE,
    recipient_role TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON Reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_department ON Reports(department);
CREATE INDEX IF NOT EXISTS idx_reports_category ON Reports(detected_category);
CREATE INDEX IF NOT EXISTS idx_assignments_report_active ON Assignments(report_id, active);
"""


def init_db(db_path: Optional[str] = None, seed: bool = True) -> None:
    conn = get_connection(db_path)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
        if seed:
            seed_initial_data(conn)
    finally:
        conn.close()


def seed_initial_data(conn: sqlite3.Connection) -> None:
    existing_teams = conn.execute("SELECT COUNT(*) FROM MaintenanceTeams").fetchone()[0]
    if existing_teams > 0:
        return

    # 1. Seed Maintenance Teams
    team_ids = {}
    for dept, info in TEAM_DIRECTORY.items():
        cur = conn.execute(
            """
            INSERT INTO MaintenanceTeams (team_code, team_name, department, description, safety_officer_email)
            VALUES (?, ?, ?, ?, ?)
            """,
            (info["team_code"], info["team_name"], dept, info["description"], info["safety_officer_email"]),
        )
        team_ids[dept] = cur.lastrowid

    # 2. Seed Routing Table
    routing_rows = [
        ("ECE:DEFAULT", "ECE", "Block-A Electronics Wing", team_ids["ECE"], 1, 0, "Routes ECE department faults to Electronics Lab"),
        ("MECH:DEFAULT", "MECH", "Block-B Mechanical Workshop", team_ids["MECH"], 1, 0, "Routes MECH department faults to Mechanical Lab"),
        ("CSE:DEFAULT", "CSE", "Block-C Computing Center", team_ids["CSE"], 1, 0, "Routes CSE department faults to IT Lab"),
        ("CENTRAL:DEFAULT", "CENTRAL", "Central Instrumentation & Stores", team_ids["CENTRAL"], 2, 1, "Routes CENTRAL faults & unknown zones to Central Stores"),
    ]
    conn.executemany(
        """
        INSERT INTO RoutingTable (routing_key, department, zone, team_id, priority_weight, is_fallback, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        routing_rows,
    )

    # 3. Seed Demo Users (Reporter, Handlers, Admin)
    users = [
        ("USR-STU-101", "Ananya Sharma", "student@college.edu", hash_password("Student@123"), "reporter", "ECE", "2026-09-02T09:00:00Z"),
        ("USR-FAC-102", "Dr. Vikram Nair", "faculty@college.edu", hash_password("Faculty@123"), "reporter", "MECH", "2026-09-03T10:15:00Z"),
        ("USR-HND-201", "Rajesh Kulkarni", "handler.ece@college.edu", hash_password("Handler@123"), "handler", "ECE", "2026-09-01T08:00:00Z"),
        ("USR-HND-202", "Meera Krishnan", "handler.mech@college.edu", hash_password("Handler@123"), "handler", "MECH", "2026-09-01T08:05:00Z"),
        ("USR-HND-203", "Arjun Deshmukh", "handler.cse@college.edu", hash_password("Handler@123"), "handler", "CSE", "2026-09-01T08:10:00Z"),
        ("USR-HND-204", "Sneha Iyer", "handler.central@college.edu", hash_password("Handler@123"), "handler", "CENTRAL", "2026-09-01T08:15:00Z"),
        ("USR-ADM-001", "Prof. Arvind Menon", "admin@college.edu", hash_password("Admin@123"), "admin", "CENTRAL", "2026-09-01T07:30:00Z"),
    ]
    user_ids = {}
    for u in users:
        cur = conn.execute(
            """
            INSERT INTO Users (user_code, name, email, password_hash, role, department, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            u,
        )
        user_ids[u[0]] = cur.lastrowid

    # 4. Seed Handlers (including backup links)
    hnd_central_cur = conn.execute(
        """
        INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload, backup_handler_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        """,
        ("HND-CEN-01", user_ids["USR-HND-204"], "Sneha Iyer", "CENTRAL", team_ids["CENTRAL"], "Calibration & Safety Triage", 1, 5, 1),
    )
    hnd_central_id = hnd_central_cur.lastrowid

    hnd_ece_cur = conn.execute(
        """
        INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload, backup_handler_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("HND-ECE-01", user_ids["USR-HND-201"], "Rajesh Kulkarni", "ECE", team_ids["ECE"], "Oscilloscopes & Power Electronics", 1, 4, 2, hnd_central_id),
    )
    hnd_ece_id = hnd_ece_cur.lastrowid

    hnd_mech_cur = conn.execute(
        """
        INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload, backup_handler_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("HND-MCH-01", user_ids["USR-HND-202"], "Meera Krishnan", "MECH", team_ids["MECH"], "CNC Machining & Hydraulics", 1, 4, 1, hnd_central_id),
    )
    hnd_mech_id = hnd_mech_cur.lastrowid

    hnd_cse_cur = conn.execute(
        """
        INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload, backup_handler_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("HND-CSE-01", user_ids["USR-HND-203"], "Arjun Deshmukh", "CSE", team_ids["CSE"], "Workstations, Servers & Drivers", 1, 5, 1, hnd_central_id),
    )
    hnd_cse_id = hnd_cse_cur.lastrowid

    # Additional ECE technician for realistic capacity distribution
    conn.execute(
        """
        INSERT INTO Handlers (handler_code, user_id, name, department, team_id, specialization, is_available, max_capacity, current_workload, backup_handler_id)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("HND-ECE-02", "Karthik Rao", "ECE", team_ids["ECE"], "Signal Generators & PCB Stations", 1, 3, 0, hnd_ece_id),
    )

    # 5. Seed Realistic Historical & Active Reports across Departments, Months & Categories
    sample_reports = [
        (
            "RPT-202609-001", user_ids["USR-STU-101"], "Ananya Sharma", "1RN24EC014", "ECE", "Digital Electronics Lab",
            "Block-A Electronics Wing", "LABECE104-ITEM201", "FLT10",
            "DC bench power supply shows no power output and main indicator LED remains dark.",
            "High", "2026-09-14T10:30:00Z", 1, json.dumps([]), 1, 1,
            "Hardware", "Fault code FLT10 maps to Hardware (No Power / PSU Failure); description confirms no power.",
            "High (Code + Description Agreement)", "High", 2, 0,
            "ROUTED_PRIMARY_TEAM", team_ids["ECE"], hnd_ece_id, "Resolved",
            "Replaced blown internal bridge rectifier and verified 0-30V regulated load test.",
            "2026-09-14T10:30:00Z", "2026-09-15T14:20:00Z",
        ),
        (
            "RPT-202610-002", user_ids["USR-FAC-102"], "Dr. Vikram Nair", "FAC-ME-008", "MECH", "Metrology & Calibration Lab",
            "Block-B Mechanical Workshop", "LABMECH202-ITEM045", "FLT23",
            "Universal testing machine load cell reading drifts by +4.8% from calibrated reference weight.",
            "Medium", "2026-10-05T11:10:00Z", 1, json.dumps([]), 1, 1,
            "Calibration", "Fault code FLT23 maps to Calibration (Load Cell Tolerance Mismatch); description confirms drift.",
            "High (Code + Description Agreement)", "Medium", 3, 0,
            "ROUTED_PRIMARY_TEAM", team_ids["MECH"], hnd_mech_id, "In Progress",
            "Zero-offset recalibration underway with certified 50kg deadweight standard.",
            "2026-10-05T11:10:00Z", "2026-10-06T09:00:00Z",
        ),
        (
            "RPT-202610-003", user_ids["USR-STU-101"], "Ananya Sharma", "1RN24EC014", "CSE", "Systems Programming Lab",
            "Block-C Computing Center", "LABCSE301-ITEM112", "FLT31",
            "Lab workstation FPGA USB-JTAG driver crashes during synthesis upload on Linux nodes.",
            "Medium", "2026-10-19T15:45:00Z", 1, json.dumps([]), 1, 1,
            "Software", "Fault code FLT31 maps to Software (Instrument Driver Error); description confirms driver crash.",
            "High (Code + Description Agreement)", "Medium", 3, 0,
            "ROUTED_PRIMARY_TEAM", team_ids["CSE"], hnd_cse_id, "Assigned",
            "",
            "2026-10-19T15:45:00Z", "2026-10-19T15:46:00Z",
        ),
        (
            "RPT-202611-004", user_ids["USR-STU-101"], "Ananya Sharma", "1RN24EC014", "ECE", "Power Electronics Lab",
            "Block-A Electronics Wing", "LABECE110-ITEM088", "FLT02",
            "Mild smoke and burning insulation odor detected near transformer secondary terminal during practical.",
            "Emergency/Critical", "2026-11-08T09:20:00Z", 1, json.dumps([]), 1, 1,
            "Safety", "Fault code FLT02 maps to Safety (Smoke / Thermal Overheat); description confirms smoke hazard.",
            "High (Code + Description Agreement)", "Emergency/Critical", 1, 1,
            "PRIORITY_OVERRIDE_PRIMARY_TEAM", team_ids["ECE"], hnd_ece_id, "In Progress",
            "Unit isolated at main breaker; thermal inspection of transformer winding in progress.",
            "2026-11-08T09:20:00Z", "2026-11-08T09:25:00Z",
        ),
        (
            "RPT-202611-005", user_ids["USR-FAC-102"], "Dr. Vikram Nair", "FAC-ME-008", "CENTRAL", "Central Soldering & Stores",
            "Central Instrumentation & Stores", "LABCENTRAL001-ITEM019", "FLT40",
            "Lead-free solder spools and rosin flux syringes depleted at assembly bench 4.",
            "Low", "2026-11-10T14:05:00Z", 1, json.dumps([]), 1, 1,
            "Consumable", "Fault code FLT40 maps to Consumable (Depleted Solder Wire / Flux); description confirms depleted.",
            "High (Code + Description Agreement)", "Low", 4, 0,
            "ROUTED_PRIMARY_TEAM", team_ids["CENTRAL"], hnd_central_id, "Assigned",
            "",
            "2026-11-10T14:05:00Z", "2026-11-10T14:06:00Z",
        ),
        (
            "RPT-202611-006", user_ids["USR-STU-101"], "Ananya Sharma", "1RN24EC014", "ECE", "Analog Circuits Lab",
            "Block-A Electronics Wing", "LABECE102-ITEM305", "FLT22",
            "Dual-channel oscilloscope channel 2 trigger drifts intermittently above 5 MHz.",
            "High", "2026-11-11T11:30:00Z", 1, json.dumps([]), 1, 1,
            "Calibration", "Fault code FLT22 maps to Calibration (Oscilloscope Trigger Drift); description confirms drift.",
            "High (Code + Description Agreement)", "High", 2, 0,
            "ROUTED_PRIMARY_TEAM", team_ids["ECE"], hnd_ece_id, "Assigned",
            "",
            "2026-11-11T11:30:00Z", "2026-11-11T11:32:00Z",
        ),
    ]

    conn.executemany(
        """
        INSERT INTO Reports (
            report_id, reporter_user_id, reporter_name, reporter_id_code, department, lab_name,
            routing_zone, equipment_id, fault_code, fault_description, urgency, reported_at,
            dfa_valid, dfa_trace, regex_valid, validation_agreement,
            detected_category, classification_reason, classification_confidence,
            priority_level, priority_rank, priority_override, routing_decision,
            assigned_team_id, assigned_handler_id, status, resolution_notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        sample_reports,
    )

    # Seed Assignments matching active/resolved sample reports
    assignments = [
        ("RPT-202609-001", hnd_ece_id, team_ids["ECE"], "AUTO_DISPATCH", 0, 0, "ROUTED_PRIMARY_TEAM", "2026-09-14T10:30:05Z", 0),
        ("RPT-202610-002", hnd_mech_id, team_ids["MECH"], "AUTO_DISPATCH", 0, 0, "ROUTED_PRIMARY_TEAM", "2026-10-05T11:10:05Z", 1),
        ("RPT-202610-003", hnd_cse_id, team_ids["CSE"], "AUTO_DISPATCH", 0, 0, "ROUTED_PRIMARY_TEAM", "2026-10-19T15:45:05Z", 1),
        ("RPT-202611-004", hnd_ece_id, team_ids["ECE"], "AUTO_DISPATCH", 0, 1, "PRIORITY_OVERRIDE_PRIMARY_TEAM", "2026-11-08T09:20:02Z", 1),
        ("RPT-202611-005", hnd_central_id, team_ids["CENTRAL"], "AUTO_DISPATCH", 0, 0, "ROUTED_PRIMARY_TEAM", "2026-11-10T14:05:05Z", 1),
        ("RPT-202611-006", hnd_ece_id, team_ids["ECE"], "AUTO_DISPATCH", 0, 0, "ROUTED_PRIMARY_TEAM", "2026-11-11T11:30:05Z", 1),
    ]
    conn.executemany(
        """
        INSERT INTO Assignments (report_id, handler_id, team_id, assigned_by, is_backup_assignment, priority_override, routing_decision, assigned_at, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        assignments,
    )

    # Seed StatusHistory
    history_rows = [
        ("RPT-202609-001", None, "Pending", user_ids["USR-STU-101"], "Ananya Sharma", "Report submitted and validated via DFA & Regex.", "2026-09-14T10:30:00Z"),
        ("RPT-202609-001", "Pending", "Assigned", None, "Auto-Dispatch Engine", "Assigned to Rajesh Kulkarni (Electronics Lab).", "2026-09-14T10:30:05Z"),
        ("RPT-202609-001", "Assigned", "Resolved", user_ids["USR-HND-201"], "Rajesh Kulkarni", "Replaced blown internal bridge rectifier and verified 0-30V regulated load test.", "2026-09-15T14:20:00Z"),
        ("RPT-202610-002", None, "Assigned", None, "Auto-Dispatch Engine", "Assigned to Meera Krishnan (Mechanical Lab).", "2026-10-05T11:10:05Z"),
        ("RPT-202610-002", "Assigned", "In Progress", user_ids["USR-HND-202"], "Meera Krishnan", "Started deadweight load cell calibration procedure.", "2026-10-06T09:00:00Z"),
        ("RPT-202611-004", None, "Assigned", None, "Auto-Dispatch Engine", "Emergency priority override applied. Assigned to Rajesh Kulkarni.", "2026-11-08T09:20:02Z"),
        ("RPT-202611-004", "Assigned", "In Progress", user_ids["USR-HND-201"], "Rajesh Kulkarni", "Unit isolated at main breaker; thermal inspection underway.", "2026-11-08T09:25:00Z"),
    ]
    conn.executemany(
        """
        INSERT INTO StatusHistory (report_id, old_status, new_status, changed_by_user_id, changed_by_name, notes, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        history_rows,
    )

    # Seed Safety Notification for RPT-202611-004
    conn.execute(
        """
        INSERT INTO Notifications (report_id, recipient_role, recipient_name, notification_type, severity, title, message, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (
            "RPT-202611-004",
            "safety_officer",
            "Lab Safety Officer (ECE)",
            "SAFETY_OFFICER_ALERT",
            "critical",
            "Safety Hazard Reported: LABECE110-ITEM088 in Power Electronics Lab",
            "Immediate safety inspection required for LABECE110-ITEM088 (ECE / Power Electronics Lab). Assigned team: Electronics Lab.",
            "2026-11-08T09:20:02Z",
        ),
    )

    conn.commit()
