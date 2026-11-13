"""
Automatic Routing Engine.

Looks up the responsible maintenance team using the SQLite RoutingTable.
Handles:
    - Extracting routing keys strictly from validated reports
    - Department-to-Team lookup (ECE -> Electronics Lab, MECH -> Mechanical Lab, CSE -> IT Lab, CENTRAL -> Central Stores)
    - Unknown routing zones -> Central Stores fallback / correction queue
    - Emergency/Critical priority override flag
    - Safety category immediate Lab Safety Officer notification trigger
"""

from __future__ import annotations
import sqlite3
from typing import Any, Dict, Optional

from models import URGENCY_PRIORITY_RANK


def resolve_priority(urgency: str, detected_category: str) -> Dict[str, Any]:
    normalized_urgency = urgency if urgency in URGENCY_PRIORITY_RANK else "Medium"
    base_rank = URGENCY_PRIORITY_RANK[normalized_urgency]
    priority_override = normalized_urgency == "Emergency/Critical"

    return {
        "priority_level": normalized_urgency,
        "priority_rank": base_rank,
        "priority_override": priority_override,
        "safety_alert_required": detected_category == "Safety",
    }


def route_validated_report(
    conn: sqlite3.Connection,
    *,
    department: str,
    routing_zone: Optional[str],
    dfa_valid: bool,
    regex_valid: bool,
    urgency: str,
    detected_category: str,
) -> Dict[str, Any]:
    """
    Determine target maintenance team & routing decision from a validated report.
    """
    if not (dfa_valid and regex_valid):
        raise ValueError("Routing rejected: identifiers must pass both DFA and Regex validation before routing.")

    dept_key = (department or "").strip().upper()
    zone_key = (routing_zone or "").strip()

    # Check if an explicit routing zone rule exists in RoutingTable
    row = None
    if zone_key and zone_key.upper() not in ("DEFAULT", ""):
        row = conn.execute(
            """
            SELECT rt.*, mt.team_name, mt.team_code, mt.department AS team_department
            FROM RoutingTable rt
            JOIN MaintenanceTeams mt ON mt.id = rt.team_id
            WHERE UPPER(rt.department) = ? AND UPPER(rt.zone) = UPPER(?)
            LIMIT 1
            """,
            (dept_key, zone_key),
        ).fetchone()

    # Check if routing_zone explicitly signals an unknown/unmapped zone
    unknown_zone = False
    if row is None:
        # Look up department default rule
        row = conn.execute(
            """
            SELECT rt.*, mt.team_name, mt.team_code, mt.department AS team_department
            FROM RoutingTable rt
            JOIN MaintenanceTeams mt ON mt.id = rt.team_id
            WHERE UPPER(rt.department) = ?
            ORDER BY rt.is_fallback ASC, rt.id ASC
            LIMIT 1
            """,
            (dept_key,),
        ).fetchone()

        # If department itself isn't in RoutingTable, OR zone is explicitly an unknown zone token
        if row is None or (
            zone_key
            and zone_key.lower() not in (
                "default",
                "block-a electronics wing",
                "block-b mechanical workshop",
                "block-c computing center",
                "central instrumentation & stores",
            )
            and zone_key.upper().startswith("UNKNOWN")
        ):
            unknown_zone = True

    if unknown_zone or row is None:
        fallback_row = conn.execute(
            """
            SELECT rt.*, mt.team_name, mt.team_code, mt.department AS team_department
            FROM RoutingTable rt
            JOIN MaintenanceTeams mt ON mt.id = rt.team_id
            WHERE rt.is_fallback = 1 OR UPPER(mt.department) = 'CENTRAL'
            ORDER BY rt.is_fallback DESC, rt.id ASC
            LIMIT 1
            """
        ).fetchone()
        if fallback_row is None:
            raise RuntimeError("Central fallback team is missing from MaintenanceTeams/RoutingTable.")
        row = fallback_row
        is_fallback = True
    else:
        is_fallback = False

    priority_info = resolve_priority(urgency, detected_category)

    if is_fallback:
        decision = "FALLBACK_CORRECTION_QUEUE"
    elif priority_info["priority_override"]:
        decision = "PRIORITY_OVERRIDE_PRIMARY_TEAM"
    else:
        decision = "ROUTED_PRIMARY_TEAM"

    return {
        "team_id": row["team_id"],
        "team_code": row["team_code"],
        "team_name": row["team_name"],
        "team_department": row["team_department"],
        "routing_key": row["routing_key"],
        "zone": zone_key or row["zone"],
        "is_fallback": is_fallback,
        "routing_decision": decision,
        **priority_info,
    }
