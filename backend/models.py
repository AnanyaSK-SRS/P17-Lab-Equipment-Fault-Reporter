"""Domain constants, status definitions, and record serializers."""

from __future__ import annotations
from typing import Any, Dict

ROLES = ("reporter", "handler", "admin")

SUPPORTED_DEPARTMENTS = ("ECE", "MECH", "CSE", "CENTRAL")

CATEGORIES = (
    "Safety",
    "Hardware",
    "Calibration",
    "Software",
    "Consumable",
)

# Deterministic priority order when multiple classification patterns match
CATEGORY_PRIORITY_ORDER = {
    "Safety": 1,
    "Hardware": 2,
    "Calibration": 3,
    "Software": 4,
    "Consumable": 5,
}

URGENCY_LEVELS = (
    "Emergency/Critical",
    "High",
    "Medium",
    "Low",
)

URGENCY_PRIORITY_RANK = {
    "Emergency/Critical": 1,
    "High": 2,
    "Medium": 3,
    "Low": 4,
}

REPORT_STATUSES = (
    "Pending",
    "Assigned",
    "In Progress",
    "Resolved",
)

TEAM_DIRECTORY = {
    "ECE": {
        "team_code": "TEAM-ECE",
        "team_name": "Electronics Lab",
        "description": "Oscilloscopes, power supplies, FPGA trainers, PCB stations, and circuit benches.",
        "safety_officer_email": "safety-ece@college.edu",
    },
    "MECH": {
        "team_code": "TEAM-MECH",
        "team_name": "Mechanical Lab",
        "description": "CNC lathes, hydraulic benches, thermal rigs, universal testing machines, and CAD stations.",
        "safety_officer_email": "safety-mech@college.edu",
    },
    "CSE": {
        "team_code": "TEAM-CSE",
        "team_name": "IT Lab",
        "description": "Workstations, rack servers, network switches, compiler clusters, and projection systems.",
        "safety_officer_email": "safety-cse@college.edu",
    },
    "CENTRAL": {
        "team_code": "TEAM-CENTRAL",
        "team_name": "Central Stores",
        "description": "Shared instrumentation, central calibration spares, consumables depot, and fallback triage.",
        "safety_officer_email": "safety-central@college.edu",
    },
}


def row_to_dict(row: Any) -> Dict[str, Any]:
    if row is None:
        return {}
    return dict(row)
