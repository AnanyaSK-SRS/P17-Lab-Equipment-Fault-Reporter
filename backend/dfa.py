"""
Deterministic Finite Automaton (DFA) validators for Equipment IDs and Fault Codes.

Equipment ID Grammar:
    LAB[DEPT][3-digit]-ITEM[3-digit]
    where DEPT in {ECE, MECH, CSE, CENTRAL}

Fault Code Grammar:
    FLT[2-digit]
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple


@dataclass
class DFATransitionStep:
    step: int
    char: str
    from_state: str
    to_state: str
    accepted_so_far: bool


@dataclass
class DFAValidationResult:
    valid: bool
    input_value: str
    final_state: str
    accepting_states: List[str]
    error_message: Optional[str]
    error_position: Optional[int]
    transitions: List[Dict[str, object]]
    extracted_department: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


class EquipmentIDDFA:
    """Explicit state-transition DFA for LAB[DEPT][3-digit]-ITEM[3-digit]."""

    START_STATE = "q0"
    ACCEPT_STATES = {"q_ACCEPT"}
    DEAD_STATE = "q_DEAD"

    def __init__(self) -> None:
        self.transitions: Dict[Tuple[str, str], str] = {}
        self.expected_hints: Dict[str, str] = {}
        self._build_transition_table()

    def _add_char(self, src: str, ch: str, dst: str) -> None:
        self.transitions[(src, ch)] = dst

    def _add_digits(self, src: str, dst: str) -> None:
        for d in "0123456789":
            self.transitions[(src, d)] = dst

    def _build_transition_table(self) -> None:
        # Prefix: LAB
        self._add_char("q0", "L", "q_L")
        self.expected_hints["q0"] = "Expected 'L' at start of Equipment ID (format: LAB[DEPT][3-digit]-ITEM[3-digit])"

        self._add_char("q_L", "A", "q_LA")
        self.expected_hints["q_L"] = "Expected 'A' after 'L' in prefix 'LAB'"

        self._add_char("q_LA", "B", "q_LAB")
        self.expected_hints["q_LA"] = "Expected 'B' after 'LA' in prefix 'LAB'"

        # Department branches from q_LAB: ECE | MECH | CSE | CENTRAL
        self.expected_hints["q_LAB"] = "Expected supported department code: ECE, MECH, CSE, or CENTRAL"

        # ECE
        self._add_char("q_LAB", "E", "q_E")
        self._add_char("q_E", "C", "q_EC")
        self._add_char("q_EC", "E", "q_DEPT_ECE")
        self.expected_hints["q_E"] = "Unsupported department code: expected 'C' for 'ECE'"
        self.expected_hints["q_EC"] = "Unsupported department code: expected 'E' for 'ECE'"

        # MECH
        self._add_char("q_LAB", "M", "q_M")
        self._add_char("q_M", "E", "q_ME")
        self._add_char("q_ME", "C", "q_MEC")
        self._add_char("q_MEC", "H", "q_DEPT_MECH")
        self.expected_hints["q_M"] = "Unsupported department code: expected 'E' for 'MECH'"
        self.expected_hints["q_ME"] = "Unsupported department code: expected 'C' for 'MECH'"
        self.expected_hints["q_MEC"] = "Unsupported department code: expected 'H' for 'MECH'"

        # CSE or CENTRAL
        self._add_char("q_LAB", "C", "q_C")
        self.expected_hints["q_C"] = "Unsupported department code: expected 'S' (CSE) or 'E' (CENTRAL)"

        self._add_char("q_C", "S", "q_CS")
        self._add_char("q_CS", "E", "q_DEPT_CSE")
        self.expected_hints["q_CS"] = "Unsupported department code: expected 'E' for 'CSE'"

        self._add_char("q_C", "E", "q_CE")
        self._add_char("q_CE", "N", "q_CEN")
        self._add_char("q_CEN", "T", "q_CENT")
        self._add_char("q_CENT", "R", "q_CENTR")
        self._add_char("q_CENTR", "A", "q_CENTRA")
        self._add_char("q_CENTRA", "L", "q_DEPT_CENTRAL")
        self.expected_hints["q_CE"] = "Unsupported department code: expected 'N' for 'CENTRAL'"
        self.expected_hints["q_CEN"] = "Unsupported department code: expected 'T' for 'CENTRAL'"
        self.expected_hints["q_CENT"] = "Unsupported department code: expected 'R' for 'CENTRAL'"
        self.expected_hints["q_CENTR"] = "Unsupported department code: expected 'A' for 'CENTRAL'"
        self.expected_hints["q_CENTRA"] = "Unsupported department code: expected 'L' for 'CENTRAL'"

        # 3-digit lab number after department
        for dept_state in ("q_DEPT_ECE", "q_DEPT_MECH", "q_DEPT_CSE", "q_DEPT_CENTRAL"):
            self._add_digits(dept_state, "q_LAB_D1")
            self.expected_hints[dept_state] = "Expected 3-digit lab number (0-9) immediately after department code"

        self._add_digits("q_LAB_D1", "q_LAB_D2")
        self.expected_hints["q_LAB_D1"] = "Incomplete lab number: expected second digit (0-9)"

        self._add_digits("q_LAB_D2", "q_LAB_D3")
        self.expected_hints["q_LAB_D2"] = "Incomplete lab number: expected third digit (0-9)"

        # Hyphen separator
        self._add_char("q_LAB_D3", "-", "q_HYPHEN")
        self.expected_hints["q_LAB_D3"] = "Expected '-' separator followed by 'ITEM[3-digit]'"

        # Literal ITEM
        self._add_char("q_HYPHEN", "I", "q_I")
        self.expected_hints["q_HYPHEN"] = "Expected 'I' in '-ITEM[3-digit]'"

        self._add_char("q_I", "T", "q_IT")
        self.expected_hints["q_I"] = "Expected 'T' after 'I' in 'ITEM'"

        self._add_char("q_IT", "E", "q_ITE")
        self.expected_hints["q_IT"] = "Expected 'E' after 'IT' in 'ITEM'"

        self._add_char("q_ITE", "M", "q_ITEM")
        self.expected_hints["q_ITE"] = "Expected 'M' after 'ITE' in 'ITEM'"

        # 3-digit item number
        self._add_digits("q_ITEM", "q_ITEM_D1")
        self.expected_hints["q_ITEM"] = "Expected 3-digit item number (0-9) after 'ITEM'"

        self._add_digits("q_ITEM_D1", "q_ITEM_D2")
        self.expected_hints["q_ITEM_D1"] = "Incomplete item number: expected second digit (0-9)"

        self._add_digits("q_ITEM_D2", "q_ACCEPT")
        self.expected_hints["q_ITEM_D2"] = "Incomplete item number: expected third digit (0-9)"

        self.expected_hints["q_ACCEPT"] = "Unexpected trailing characters after valid Equipment ID"

    def validate(self, raw_value: str) -> DFAValidationResult:
        if not isinstance(raw_value, str) or raw_value == "":
            return DFAValidationResult(
                valid=False,
                input_value=str(raw_value or ""),
                final_state=self.START_STATE,
                accepting_states=sorted(self.ACCEPT_STATES),
                error_message="Equipment ID cannot be empty (expected LAB[DEPT][3-digit]-ITEM[3-digit]).",
                error_position=0,
                transitions=[],
                extracted_department=None,
            )

        current_state = self.START_STATE
        trace: List[Dict[str, object]] = []
        detected_dept: Optional[str] = None
        error_message: Optional[str] = None
        error_position: Optional[int] = None

        for idx, ch in enumerate(raw_value):
            next_state = self.transitions.get((current_state, ch), self.DEAD_STATE)
            if next_state == "q_DEPT_ECE":
                detected_dept = "ECE"
            elif next_state == "q_DEPT_MECH":
                detected_dept = "MECH"
            elif next_state == "q_DEPT_CSE":
                detected_dept = "CSE"
            elif next_state == "q_DEPT_CENTRAL":
                detected_dept = "CENTRAL"

            trace.append(
                asdict(
                    DFATransitionStep(
                        step=idx + 1,
                        char=ch,
                        from_state=current_state,
                        to_state=next_state,
                        accepted_so_far=(next_state in self.ACCEPT_STATES),
                    )
                )
            )

            if next_state == self.DEAD_STATE and error_message is None:
                hint = self.expected_hints.get(current_state, "Invalid character in Equipment ID")
                error_message = f"Rejected at position {idx + 1} ('{ch}'): {hint}."
                error_position = idx + 1

            current_state = next_state

        is_accepted = current_state in self.ACCEPT_STATES
        if not is_accepted and error_message is None:
            hint = self.expected_hints.get(current_state, "Incomplete Equipment ID")
            error_message = f"Incomplete Equipment ID at state {current_state}: {hint}."
            error_position = len(raw_value)

        return DFAValidationResult(
            valid=is_accepted,
            input_value=raw_value,
            final_state=current_state,
            accepting_states=sorted(self.ACCEPT_STATES),
            error_message=error_message,
            error_position=error_position,
            transitions=trace,
            extracted_department=detected_dept if is_accepted else None,
        )


class FaultCodeDFA:
    """Explicit state-transition DFA for Fault Code format FLT[2-digit]."""

    START_STATE = "q0"
    ACCEPT_STATES = {"q_ACCEPT"}
    DEAD_STATE = "q_DEAD"

    def __init__(self) -> None:
        self.transitions: Dict[Tuple[str, str], str] = {}
        self.expected_hints: Dict[str, str] = {}
        self._build_transition_table()

    def _build_transition_table(self) -> None:
        self.transitions[("q0", "F")] = "q_F"
        self.expected_hints["q0"] = "Expected 'F' at start of Fault Code (format: FLT[2-digit])"

        self.transitions[("q_F", "L")] = "q_FL"
        self.expected_hints["q_F"] = "Expected 'L' after 'F' in Fault Code prefix 'FLT'"

        self.transitions[("q_FL", "T")] = "q_FLT"
        self.expected_hints["q_FL"] = "Expected 'T' after 'FL' in Fault Code prefix 'FLT'"

        for d in "0123456789":
            self.transitions[("q_FLT", d)] = "q_D1"
            self.transitions[("q_D1", d)] = "q_ACCEPT"

        self.expected_hints["q_FLT"] = "Expected first digit (0-9) after 'FLT'"
        self.expected_hints["q_D1"] = "Incomplete Fault Code: expected second digit (0-9)"
        self.expected_hints["q_ACCEPT"] = "Unexpected trailing characters after 2-digit Fault Code"

    def validate(self, raw_value: str) -> DFAValidationResult:
        if not isinstance(raw_value, str) or raw_value == "":
            return DFAValidationResult(
                valid=False,
                input_value=str(raw_value or ""),
                final_state=self.START_STATE,
                accepting_states=sorted(self.ACCEPT_STATES),
                error_message="Fault Code cannot be empty (expected FLT[2-digit], e.g., FLT12).",
                error_position=0,
                transitions=[],
            )

        current_state = self.START_STATE
        trace: List[Dict[str, object]] = []
        error_message: Optional[str] = None
        error_position: Optional[int] = None

        for idx, ch in enumerate(raw_value):
            next_state = self.transitions.get((current_state, ch), self.DEAD_STATE)
            trace.append(
                asdict(
                    DFATransitionStep(
                        step=idx + 1,
                        char=ch,
                        from_state=current_state,
                        to_state=next_state,
                        accepted_so_far=(next_state in self.ACCEPT_STATES),
                    )
                )
            )
            if next_state == self.DEAD_STATE and error_message is None:
                hint = self.expected_hints.get(current_state, "Invalid character in Fault Code")
                error_message = f"Rejected at position {idx + 1} ('{ch}'): {hint}."
                error_position = idx + 1
            current_state = next_state

        is_accepted = current_state in self.ACCEPT_STATES
        if not is_accepted and error_message is None:
            hint = self.expected_hints.get(current_state, "Incomplete Fault Code")
            error_message = f"Incomplete Fault Code at state {current_state}: {hint}."
            error_position = len(raw_value)

        return DFAValidationResult(
            valid=is_accepted,
            input_value=raw_value,
            final_state=current_state,
            accepting_states=sorted(self.ACCEPT_STATES),
            error_message=error_message,
            error_position=error_position,
            transitions=trace,
        )


equipment_id_dfa = EquipmentIDDFA()
fault_code_dfa = FaultCodeDFA()
