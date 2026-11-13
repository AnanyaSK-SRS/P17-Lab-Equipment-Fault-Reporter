"""
Automatic Report Classification Engine.

Classifies every accepted report into exactly one of five categories:
    1. Safety
    2. Hardware
    3. Calibration
    4. Software
    5. Consumable

Deterministic Priority Rule (for multi-pattern conflicts):
    Safety (1) > Hardware (2) > Calibration (3) > Software (4) > Consumable (5)
"""

from __future__ import annotations
import re
from typing import Any, Dict, List, Set

from models import CATEGORY_PRIORITY_ORDER

# Documented Fault Code Dictionary
FAULT_CODE_CATALOG: Dict[str, Dict[str, str]] = {
    # 01 - 09: Safety
    "FLT01": {"category": "Safety", "label": "Electrical Shock / Live Chassis Hazard"},
    "FLT02": {"category": "Safety", "label": "Smoke, Burning Odor, or Thermal Overheat"},
    "FLT03": {"category": "Safety", "label": "Sparking, Short Circuit, or Arc Fault"},
    "FLT04": {"category": "Safety", "label": "Chemical / Coolant / Gas Leak"},
    "FLT05": {"category": "Safety", "label": "Exposed Moving Part / Guard Interlock Failure"},
    "FLT06": {"category": "Safety", "label": "Emergency Stop / Breaker Trip Hazard"},
    # 10 - 19: Hardware
    "FLT10": {"category": "Hardware", "label": "No Power / PSU Failure"},
    "FLT11": {"category": "Hardware", "label": "Broken Port, Connector, or Probe Terminal"},
    "FLT12": {"category": "Hardware", "label": "Display / Screen / Panel Hardware Failure"},
    "FLT13": {"category": "Hardware", "label": "Motor, Spindle, or Actuator Mechanical Jam"},
    "FLT14": {"category": "Hardware", "label": "Motherboard, FPGA, or PCB Component Burnout"},
    "FLT15": {"category": "Hardware", "label": "Fan, Cooling Pump, or Chassis Physical Damage"},
    # 20 - 29: Calibration
    "FLT20": {"category": "Calibration", "label": "Voltage / Current Reading Drift"},
    "FLT21": {"category": "Calibration", "label": "Zero-Offset / Baseline Alignment Error"},
    "FLT22": {"category": "Calibration", "label": "Frequency / Oscilloscope Trigger Calibration Drift"},
    "FLT23": {"category": "Calibration", "label": "Load Cell / Pressure Gauge Tolerance Mismatch"},
    "FLT24": {"category": "Calibration", "label": "Sensor Sensitivity / Gain Calibration Required"},
    # 30 - 39: Software
    "FLT30": {"category": "Software", "label": "OS Boot Loop / Kernel Crash"},
    "FLT31": {"category": "Software", "label": "Instrument Driver or USB/GPIB Interface Error"},
    "FLT32": {"category": "Software", "label": "License Server / IDE Activation Failure"},
    "FLT33": {"category": "Software", "label": "Firmware Update Corruption / Timeout"},
    "FLT34": {"category": "Software", "label": "Lab Application Freeze or Network Config Fault"},
    # 40 - 49: Consumable
    "FLT40": {"category": "Consumable", "label": "Depleted Solder Wire, Flux, or Wick"},
    "FLT41": {"category": "Consumable", "label": "Empty Reagent, Coolant, or Lubricant"},
    "FLT42": {"category": "Consumable", "label": "Blown Replaceable Fuse / Lamp Bulb"},
    "FLT43": {"category": "Consumable", "label": "Printer Toner, Paper, or Plotter Media Empty"},
    "FLT44": {"category": "Consumable", "label": "Worn Test Leads, Breadboard Jumpers, or Electrodes"},
}

# Description keyword patterns for each category
DESCRIPTION_PATTERNS: Dict[str, List[str]] = {
    "Safety": [
        r"\bsmoke\b", r"\bspark(?:ing|s)?\b", r"\bfire\b", r"\bburn(?:ing|t)?\b",
        r"\bshock\b", r"\belectrocution\b", r"\bshort\s*circuit\b", r"\bhazard\b",
        r"\btoxic\b", r"\bleak(?:ing|age)?\b", r"\bfume(?:s)?\b", r"\boverheat(?:ing)?\b",
        r"\be-?stop\b", r"\bemergency\s*stop\b", r"\bexposed\s*wire\b", r"\bunsafe\b",
    ],
    "Hardware": [
        r"\bno\s*power\b", r"\bdead\b", r"\bbroken\b", r"\bcrack(?:ed)?\b",
        r"\bport\b", r"\bconnector\b", r"\bmotor\b", r"\bspindle\b",
        r"\bpower\s*supply\b", r"\bpsu\b", r"\bdisplay\s*blank\b", r"\bbent\b",
        r"\bjammed\b", r"\bchassis\b", r"\bfan\s*noise\b", r"\bhardware\b",
        r"\bcapacitor\b", r"\bswitch\s*stuck\b", r"\bbutton\s*broken\b",
    ],
    "Calibration": [
        r"\bcalibrat(?:e|ion|ing)\b", r"\bdrift(?:ing)?\b", r"\boffset\b",
        r"\binaccurate\b", r"\baccuracy\b", r"\btolerance\b", r"\bmismatch\b",
        r"\bzero\s*error\b", r"\bbaseline\b", r"\bscale\s*wrong\b",
        r"\bmeasurement\s*error\b", r"\balign(?:ment)?\b", r"\bsensitivity\b",
    ],
    "Software": [
        r"\bsoftware\b", r"\bdriver\b", r"\bfirmware\b", r"\bcrash(?:ing|ed)?\b",
        r"\bfreeze\b", r"\bfrozen\b", r"\bboot\s*loop\b", r"\bblue\s*screen\b",
        r"\blicense\b", r"\bide\b", r"\bcompiler\b", r"\bupdate\s*fail\b",
        r"\btimeout\b", r"\bnetwork\b", r"\binstall(?:ation)?\b", r"\bos\b",
    ],
    "Consumable": [
        r"\bfuse\b", r"\bsolder\b", r"\bflux\b", r"\btoner\b", r"\bink\b",
        r"\bpaper\b", r"\breagent\b", r"\bcoolant\b", r"\blubricant\b",
        r"\bempty\b", r"\bdepleted\b", r"\brefill\b", r"\bconsumable\b",
        r"\bfilter\b", r"\bbulb\b", r"\bbattery\b", r"\bprobe\s*tip\b",
    ],
}


def classify_report(fault_code: str, fault_description: str) -> Dict[str, Any]:
    """
    Determine the report's category using fault code lookup + description regex patterns,
    applying deterministic conflict resolution when multiple categories match.
    """
    code = (fault_code or "").strip().upper()
    desc = (fault_description or "").strip()
    desc_lower = desc.lower()

    matched_categories: Set[str] = set()
    evidence: List[str] = []

    code_entry = FAULT_CODE_CATALOG.get(code)
    code_known = code_entry is not None
    if code_entry:
        matched_categories.add(code_entry["category"])
        evidence.append(f"Fault code {code} maps to {code_entry['category']} ({code_entry['label']})")
    else:
        evidence.append(f"Fault code {code or 'N/A'} is unmapped in standard catalog")

    pattern_hits: Dict[str, List[str]] = {}
    for category, regexes in DESCRIPTION_PATTERNS.items():
        hits: List[str] = []
        for pat in regexes:
            m = re.search(pat, desc_lower)
            if m:
                hits.append(m.group(0))
        if hits:
            matched_categories.add(category)
            pattern_hits[category] = hits
            evidence.append(f"Description matched {category} keywords: {', '.join(hits[:4])}")

    # Case 1: Incomplete / too sparse description with unknown code
    if not matched_categories:
        # Never silently claim high confidence when both code and description have no match
        detected = "Hardware"
        confidence = "Low (Manual Review Flagged)"
        reason = (
            f"Unmapped fault code {code} and no recognized classification keywords in description. "
            "Assigned to Hardware for initial physical triage inspection; manual verification required."
        )
        return {
            "category": detected,
            "confidence": confidence,
            "reason": reason,
            "matched_categories": [],
            "conflict_resolved": False,
            "unmapped_code": not code_known,
            "needs_manual_review": True,
            "evidence": evidence,
        }

    # Sort all matched categories by deterministic priority order
    ordered_matches = sorted(
        matched_categories,
        key=lambda cat: CATEGORY_PRIORITY_ORDER.get(cat, 99),
    )
    detected = ordered_matches[0]
    conflict = len(ordered_matches) > 1

    if conflict:
        priority_chain = " > ".join(ordered_matches)
        confidence = "High (Conflict Resolved by Priority Rule)"
        reason = (
            f"Multiple classification patterns matched ({priority_chain}). "
            f"Applied deterministic priority rule (Safety > Hardware > Calibration > Software > Consumable) "
            f"to select {detected}. Evidence: {'; '.join(evidence)}."
        )
    elif code_known and detected in pattern_hits:
        confidence = "High (Code + Description Agreement)"
        reason = f"Fault code {code} and description patterns both confirm {detected}. {'; '.join(evidence)}."
    elif code_known:
        confidence = "High (Documented Fault Code)"
        reason = f"{evidence[0]}."
    else:
        confidence = "Medium (Description Pattern Match for Unmapped Code)"
        reason = (
            f"Unmapped fault code {code}; classified as {detected} via description pattern match. "
            f"{'; '.join(evidence)}."
        )

    return {
        "category": detected,
        "confidence": confidence,
        "reason": reason,
        "matched_categories": ordered_matches,
        "conflict_resolved": conflict,
        "unmapped_code": not code_known,
        "needs_manual_review": (not code_known and len(desc) < 12),
        "evidence": evidence,
    }
