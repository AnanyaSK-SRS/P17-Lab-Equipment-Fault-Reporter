"""
Comprehensive 20-Case Integration & Unit Test Suite for Lab Equipment Fault Reporter.
"""

from __future__ import annotations
import os
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from auth import hash_password, verify_password  # noqa: E402
from classification import classify_report  # noqa: E402
from database import get_connection, init_db  # noqa: E402
from dispatch import (  # noqa: E402
    assign_report_to_handler,
    get_pending_queue,
    process_dispatch_queue,
    submit_and_dispatch_report,
    update_report_status,
)
from routing import route_validated_report  # noqa: E402
from validation import (  # noqa: E402
    validate_equipment_identifier,
    validate_fault_code,
    validate_submission_identifiers,
)


class LabFaultReporterTestSuite(unittest.TestCase):
    """20 end-to-end tests covering DFA, Regex, Classification, Routing, Dispatch, and SQLite Persistence."""

    def setUp(self) -> None:
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self.db_path = self.tmp.name
        init_db(self.db_path, seed=True)
        self.conn = get_connection(self.db_path)

    def tearDown(self) -> None:
        self.conn.close()
        if os.path.exists(self.db_path):
            os.unlink(self.db_path)

    def _sample_payload(self, **overrides):
        base = {
            "reporter_name": "Ananya Sharma",
            "reporter_id_code": "1RN24EC014",
            "department": "ECE",
            "lab_name": "Digital Electronics Lab",
            "routing_zone": "Block-A Electronics Wing",
            "equipment_id": "LABECE123-ITEM456",
            "fault_code": "FLT10",
            "fault_description": "Oscilloscope shows no power and PSU indicator LED is off.",
            "urgency": "Medium",
        }
        base.update(overrides)
        return base

    # 1. Valid equipment ID
    def test_01_valid_equipment_id(self):
        for eq_id in ("LABECE123-ITEM456", "LABMECH001-ITEM999", "LABCSE302-ITEM007", "LABCENTRAL042-ITEM100"):
            res = validate_equipment_identifier(eq_id)
            self.assertTrue(res["valid"], f"Expected valid for {eq_id}")
            self.assertTrue(res["dfa"]["valid"])
            self.assertTrue(res["regex"]["valid"])

    # 2. Invalid equipment ID
    def test_02_invalid_equipment_id(self):
        invalid_ids = [
            "",
            "LABECE12-ITEM456",       # incomplete lab digits
            "LABECE123-ITEM45",       # incomplete item digits
            "labece123-item456",      # lowercase
            "ECE123-ITEM456",         # missing LAB prefix
            "LABECE123ITEM456",       # missing hyphen
            "LABECE123-ITEM456X",     # trailing char
        ]
        for eq_id in invalid_ids:
            res = validate_equipment_identifier(eq_id)
            self.assertFalse(res["valid"], f"Expected invalid for {eq_id}")
            self.assertIsNotNone(res["error_message"])

    # 3. Valid fault code
    def test_03_valid_fault_code(self):
        for code in ("FLT01", "FLT12", "FLT44", "FLT99"):
            res = validate_fault_code(code)
            self.assertTrue(res["valid"])

    # 4. Invalid fault code
    def test_04_invalid_fault_code(self):
        for code in ("", "FLT1", "FLT123", "ERR12", "flt12", "FLT1A"):
            res = validate_fault_code(code)
            self.assertFalse(res["valid"], f"Expected invalid fault code for {code}")

    # 5. DFA and Regex agreement
    def test_05_dfa_and_regex_agreement(self):
        eq_corpus = [
            "LABECE123-ITEM456", "LABMECH200-ITEM010", "LABCSE999-ITEM000", "LABCENTRAL100-ITEM200",
            "LABBIO123-ITEM456", "LABECE12-ITEM456", "LABECE123-ITEM45", "LABECE123-PART456", "bad",
        ]
        for eq in eq_corpus:
            res = validate_equipment_identifier(eq)
            self.assertTrue(res["agreement"], f"DFA/Regex disagreed on {eq}")

        fc_corpus = ["FLT00", "FLT12", "FLT99", "FLT1", "FLT123", "ABC12", "flt12"]
        for fc in fc_corpus:
            res = validate_fault_code(fc)
            self.assertTrue(res["agreement"], f"DFA/Regex disagreed on {fc}")

    # 6. Hardware classification
    def test_06_hardware_classification(self):
        res = classify_report("FLT10", "Bench PSU has no power output and broken rocker switch.")
        self.assertEqual(res["category"], "Hardware")

    # 7. Calibration classification
    def test_07_calibration_classification(self):
        res = classify_report("FLT20", "Multimeter voltage reading drifts with a +0.4V zero offset.")
        self.assertEqual(res["category"], "Calibration")

    # 8. Software classification
    def test_08_software_classification(self):
        res = classify_report("FLT31", "Instrument USB driver crashes with timeout during firmware upload.")
        self.assertEqual(res["category"], "Software")

    # 9. Safety classification + immediate Safety Officer notification
    def test_09_safety_classification_and_notification(self):
        result = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                fault_code="FLT02",
                fault_description="Smoke and sparking observed near transformer terminals.",
                urgency="High",
            ),
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["classification"]["category"], "Safety")
        self.assertTrue(result["routing"]["safety_notified"])
        notif = self.conn.execute(
            "SELECT * FROM Notifications WHERE report_id = ? AND notification_type = 'SAFETY_OFFICER_ALERT'",
            (result["report_id"],),
        ).fetchone()
        self.assertIsNotNone(notif)

    # 10. Consumable classification
    def test_10_consumable_classification(self):
        res = classify_report("FLT40", "Solder wire spool and flux syringe are completely depleted.")
        self.assertEqual(res["category"], "Consumable")

    # 11. Conflicting classification patterns (deterministic priority rule)
    def test_11_conflicting_classification_patterns(self):
        # Mentions Software (driver crash), Calibration (drift), and Safety (smoke/spark)
        res = classify_report("FLT31", "USB driver crash happened right before reading drift and smoke spark.")
        self.assertTrue(res["conflict_resolved"])
        self.assertEqual(res["category"], "Safety")
        self.assertIn("deterministic priority rule", res["reason"].lower())

    # 12. Unknown routing zone -> Central fallback/correction queue
    def test_12_unknown_routing_zone(self):
        routing = route_validated_report(
            self.conn,
            department="ECE",
            routing_zone="UNKNOWN-WING-Z",
            dfa_valid=True,
            regex_valid=True,
            urgency="Medium",
            detected_category="Hardware",
        )
        self.assertTrue(routing["is_fallback"])
        self.assertEqual(routing["routing_decision"], "FALLBACK_CORRECTION_QUEUE")
        self.assertEqual(routing["team_name"], "Central Stores")

    # 13. Invalid department code rejected by DFA & Regex
    def test_13_invalid_department_code(self):
        res = validate_submission_identifiers("LABBIO123-ITEM456", "FLT10")
        self.assertFalse(res["valid"])
        self.assertTrue(res["agreement"])
        self.assertIn("department", res["equipment_id"]["error_message"].lower())

    # 14. Handler unavailability -> backup handler selected
    def test_14_handler_unavailability_backup_selection(self):
        # Disable all MECH primary handlers
        self.conn.execute("UPDATE Handlers SET is_available = 0 WHERE department = 'MECH'")
        self.conn.commit()
        result = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                department="MECH",
                lab_name="CNC Workshop",
                routing_zone="Block-B Mechanical Workshop",
                equipment_id="LABMECH105-ITEM022",
                fault_code="FLT13",
                fault_description="CNC spindle motor jammed during lab session.",
            ),
        )
        self.assertTrue(result["success"])
        self.assertTrue(result["assignment"]["is_backup_assignment"])
        self.assertEqual(result["routing"]["routing_decision"], "BACKUP_HANDLER_ASSIGNED")
        self.assertIsNotNone(result["assignment"]["assigned_handler_id"])

    # 15. Handler capacity overflow -> queued in Pending status
    def test_15_handler_capacity_overflow(self):
        # Set all CSE and CENTRAL handlers to full capacity
        self.conn.execute("UPDATE Handlers SET current_workload = max_capacity WHERE department IN ('CSE', 'CENTRAL')")
        self.conn.commit()
        result = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                department="CSE",
                lab_name="Systems Lab",
                routing_zone="Block-C Computing Center",
                equipment_id="LABCSE201-ITEM088",
                fault_code="FLT30",
                fault_description="Workstation stuck in OS boot loop.",
                urgency="Low",
            ),
        )
        self.assertTrue(result["success"])
        self.assertEqual(result["assignment"]["status"], "Pending")
        self.assertIsNone(result["assignment"]["assigned_handler_id"])
        self.assertEqual(result["assignment"]["queue_position"], 1)

    # 16. Emergency priority override
    def test_16_emergency_priority_override(self):
        result = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                urgency="Emergency/Critical",
                fault_code="FLT14",
                fault_description="Main FPGA trainer board capacitor ruptured.",
            ),
        )
        self.assertTrue(result["success"])
        self.assertTrue(result["routing"]["priority_override"])
        self.assertEqual(result["routing"]["priority_rank"], 1)

    # 17. Multiple incoming reports and deterministic queue ordering
    def test_17_multiple_reports_queue_ordering(self):
        # Saturate CSE and Central handlers so incoming CSE reports queue
        self.conn.execute("UPDATE Handlers SET current_workload = max_capacity WHERE department IN ('CSE', 'CENTRAL')")
        self.conn.commit()

        r_low = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                department="CSE", lab_name="Lab 1", routing_zone="Block-C Computing Center",
                equipment_id="LABCSE101-ITEM001", fault_code="FLT30",
                fault_description="OS boot loop on node 1.", urgency="Low",
            ),
        )
        r_med = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                department="CSE", lab_name="Lab 1", routing_zone="Block-C Computing Center",
                equipment_id="LABCSE101-ITEM002", fault_code="FLT31",
                fault_description="Driver timeout on node 2.", urgency="Medium",
            ),
        )
        r_crit = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                department="CSE", lab_name="Lab 1", routing_zone="Block-C Computing Center",
                equipment_id="LABCSE101-ITEM003", fault_code="FLT03",
                fault_description="Short circuit spark at server rack.", urgency="Emergency/Critical",
            ),
        )

        queue = get_pending_queue(self.conn)
        ordered_ids = [q["report_id"] for q in queue]
        self.assertEqual(ordered_ids, [r_crit["report_id"], r_med["report_id"], r_low["report_id"]])

    # 18. Duplicate assignment prevention
    def test_18_duplicate_assignment_prevention(self):
        result = submit_and_dispatch_report(self.conn, self._sample_payload())
        report_id = result["report_id"]
        handler_id = result["assignment"]["assigned_handler_id"]
        team_id = result["routing"]["team_id"]
        self.assertIsNotNone(handler_id)

        with self.assertRaises(ValueError) as ctx:
            assign_report_to_handler(
                self.conn,
                report_id=report_id,
                handler_id=handler_id,
                team_id=team_id,
                assigned_by="MANUAL_TEST",
                is_backup_assignment=False,
                priority_override=False,
                routing_decision="DUPLICATE_CHECK",
            )
        self.assertIn("duplicate assignment prevented", str(ctx.exception).lower())

    # 19. Status updates and queue drain on resolution
    def test_19_status_updates_and_capacity_release(self):
        # Saturate CSE and Central handlers, submit one queued report, then resolve an existing CSE report
        self.conn.execute("UPDATE Handlers SET current_workload = max_capacity WHERE department IN ('CSE', 'CENTRAL')")
        self.conn.commit()
        queued = submit_and_dispatch_report(
            self.conn,
            self._sample_payload(
                department="CSE", lab_name="Compiler Lab", routing_zone="Block-C Computing Center",
                equipment_id="LABCSE404-ITEM010", fault_code="FLT32",
                fault_description="IDE license activation failure.", urgency="High",
            ),
        )
        self.assertEqual(queued["assignment"]["status"], "Pending")

        # Adjust CSE handler workload back to realistic 1/5 and resolve active CSE report RPT-202610-003
        self.conn.execute("UPDATE Handlers SET current_workload = 1 WHERE handler_code = 'HND-CSE-01'")
        self.conn.commit()
        update_report_status(
            self.conn,
            report_id="RPT-202610-003",
            new_status="In Progress",
            resolution_notes="Reinstalling USB JTAG kernel module.",
            actor_name="Arjun Deshmukh",
        )
        res = update_report_status(
            self.conn,
            report_id="RPT-202610-003",
            new_status="Resolved",
            resolution_notes="Driver updated and tested successfully.",
            actor_name="Arjun Deshmukh",
        )
        self.assertEqual(res["report"]["status"], "Resolved")
        dispatched_ids = [d["report_id"] for d in res["dispatched_from_queue"]]
        self.assertIn(queued["report_id"], dispatched_ids)

    # 20. End-to-end database persistence and password hash verification
    def test_20_database_persistence_and_auth(self):
        pw_hash = hash_password("SecureLab#2026")
        self.assertTrue(verify_password("SecureLab#2026", pw_hash))
        self.assertFalse(verify_password("WrongPass", pw_hash))

        submitted = submit_and_dispatch_report(self.conn, self._sample_payload())
        rid = submitted["report_id"]
        self.conn.close()

        # Re-open a fresh SQLite connection to verify persistence on disk
        self.conn = get_connection(self.db_path)
        persisted = self.conn.execute("SELECT * FROM Reports WHERE report_id = ?", (rid,)).fetchone()
        self.assertIsNotNone(persisted)
        self.assertEqual(persisted["equipment_id"], "LABECE123-ITEM456")
        self.assertEqual(persisted["dfa_valid"], 1)
        self.assertEqual(persisted["regex_valid"], 1)
        process_dispatch_queue(self.conn)


def run_test_suite_structured() -> dict:
    """Execute all tests programmatically and return structured JSON results for the UI."""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(LabFaultReporterTestSuite)
    results = []
    passed = 0
    failed = 0

    for test in suite:
        res = unittest.TestResult()
        test.run(res)
        name = test._testMethodName
        ok = res.wasSuccessful()
        if ok:
            passed += 1
        else:
            failed += 1
        err_msg = ""
        if res.failures:
            err_msg = res.failures[0][1]
        elif res.errors:
            err_msg = res.errors[0][1]
        results.append({
            "name": name,
            "label": name.replace("test_", "").replace("_", " ").title(),
            "passed": ok,
            "error": err_msg,
        })

    return {
        "total": passed + failed,
        "passed": passed,
        "failed": failed,
        "all_passed": failed == 0,
        "tests": results,
    }


if __name__ == "__main__":
    unittest.main(verbosity=2)
