"""
Combined DFA + Regex Validation Module with agreement verification.
"""

from __future__ import annotations
from typing import Any, Dict

from dfa import equipment_id_dfa, fault_code_dfa
from regex_validator import validate_equipment_id_regex, validate_fault_code_regex


def validate_equipment_identifier(equipment_id: str) -> Dict[str, Any]:
    cleaned = equipment_id if isinstance(equipment_id, str) else ""
    dfa_res = equipment_id_dfa.validate(cleaned)
    regex_res = validate_equipment_id_regex(cleaned)
    agreement = dfa_res.valid == regex_res.valid

    return {
        "valid": bool(dfa_res.valid and regex_res.valid and agreement),
        "agreement": agreement,
        "dfa": dfa_res.to_dict(),
        "regex": regex_res.to_dict(),
        "department_extracted": dfa_res.extracted_department,
        "error_message": None if (dfa_res.valid and regex_res.valid) else (dfa_res.error_message or regex_res.error_message),
    }


def validate_fault_code(fault_code: str) -> Dict[str, Any]:
    cleaned = fault_code if isinstance(fault_code, str) else ""
    dfa_res = fault_code_dfa.validate(cleaned)
    regex_res = validate_fault_code_regex(cleaned)
    agreement = dfa_res.valid == regex_res.valid

    return {
        "valid": bool(dfa_res.valid and regex_res.valid and agreement),
        "agreement": agreement,
        "dfa": dfa_res.to_dict(),
        "regex": regex_res.to_dict(),
        "error_message": None if (dfa_res.valid and regex_res.valid) else (dfa_res.error_message or regex_res.error_message),
    }


def validate_submission_identifiers(equipment_id: str, fault_code: str) -> Dict[str, Any]:
    eq_validation = validate_equipment_identifier(equipment_id)
    fc_validation = validate_fault_code(fault_code)

    overall_valid = eq_validation["valid"] and fc_validation["valid"]
    overall_agreement = eq_validation["agreement"] and fc_validation["agreement"]

    errors = []
    if not eq_validation["valid"] and eq_validation["error_message"]:
        errors.append(f"Equipment ID: {eq_validation['error_message']}")
    if not fc_validation["valid"] and fc_validation["error_message"]:
        errors.append(f"Fault Code: {fc_validation['error_message']}")

    return {
        "valid": overall_valid,
        "dfa_valid": eq_validation["dfa"]["valid"] and fc_validation["dfa"]["valid"],
        "regex_valid": eq_validation["regex"]["valid"] and fc_validation["regex"]["valid"],
        "agreement": overall_agreement,
        "equipment_id": eq_validation,
        "fault_code": fc_validation,
        "errors": errors,
    }
