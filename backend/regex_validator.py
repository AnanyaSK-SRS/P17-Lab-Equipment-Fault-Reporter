"""
Regular-Expression validators mathematically equivalent to the DFA definitions.

Equipment ID Regex:
    ^LAB(?:ECE|MECH|CSE|CENTRAL)[0-9]{3}-ITEM[0-9]{3}$

Fault Code Regex:
    ^FLT[0-9]{2}$
"""

from __future__ import annotations
import re
from dataclasses import dataclass, asdict
from typing import Dict, Optional

EQUIPMENT_ID_PATTERN = re.compile(r"^LAB(ECE|MECH|CSE|CENTRAL)([0-9]{3})-ITEM([0-9]{3})$")
FAULT_CODE_PATTERN = re.compile(r"^FLT([0-9]{2})$")


@dataclass
class RegexValidationResult:
    valid: bool
    input_value: str
    pattern: str
    error_message: Optional[str]
    captured_groups: Optional[Dict[str, str]] = None

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


def validate_equipment_id_regex(value: str) -> RegexValidationResult:
    if not isinstance(value, str) or not value:
        return RegexValidationResult(
            valid=False,
            input_value=str(value or ""),
            pattern=EQUIPMENT_ID_PATTERN.pattern,
            error_message="Equipment ID cannot be empty; expected LAB[DEPT][3-digit]-ITEM[3-digit].",
        )

    match = EQUIPMENT_ID_PATTERN.fullmatch(value)
    if match:
        return RegexValidationResult(
            valid=True,
            input_value=value,
            pattern=EQUIPMENT_ID_PATTERN.pattern,
            error_message=None,
            captured_groups={
                "department": match.group(1),
                "lab_number": match.group(2),
                "item_number": match.group(3),
            },
        )

    # Diagnostic explanation for rejected inputs
    if not value.startswith("LAB"):
        reason = "Must begin with uppercase prefix 'LAB'."
    elif "-ITEM" not in value:
        reason = "Missing or malformed '-ITEM[3-digit]' segment."
    else:
        prefix_part = value.split("-ITEM", 1)[0]
        dept_candidate = prefix_part[3:]
        if not re.match(r"^(ECE|MECH|CSE|CENTRAL)[0-9]{3}$", dept_candidate):
            if not re.match(r"^(ECE|MECH|CSE|CENTRAL)", dept_candidate):
                reason = "Unsupported or malformed department code (allowed: ECE, MECH, CSE, CENTRAL)."
            else:
                reason = "Department code must be followed by exactly 3 digits."
        else:
            reason = "ITEM suffix must be followed by exactly 3 digits."

    return RegexValidationResult(
        valid=False,
        input_value=value,
        pattern=EQUIPMENT_ID_PATTERN.pattern,
        error_message=f"Regex mismatch: {reason}",
    )


def validate_fault_code_regex(value: str) -> RegexValidationResult:
    if not isinstance(value, str) or not value:
        return RegexValidationResult(
            valid=False,
            input_value=str(value or ""),
            pattern=FAULT_CODE_PATTERN.pattern,
            error_message="Fault Code cannot be empty; expected FLT[2-digit].",
        )

    match = FAULT_CODE_PATTERN.fullmatch(value)
    if match:
        return RegexValidationResult(
            valid=True,
            input_value=value,
            pattern=FAULT_CODE_PATTERN.pattern,
            error_message=None,
            captured_groups={"code_digits": match.group(1)},
        )

    if not value.startswith("FLT"):
        reason = "Fault Code must start with uppercase 'FLT'."
    else:
        reason = "Fault Code must contain exactly 2 digits after 'FLT' (e.g., FLT12)."

    return RegexValidationResult(
        valid=False,
        input_value=value,
        pattern=FAULT_CODE_PATTERN.pattern,
        error_message=f"Regex mismatch: {reason}",
    )
