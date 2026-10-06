"""Tests for complete event-to-new-allocation orchestration."""

from __future__ import annotations

import unittest

from emergency.reoptimization import QAOAUnavailableError, run_emergency_reoptimization
from emergency.simulator import DemandSpike
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.qubo import QUBOPenaltyConfig


def scenario() -> Scenario:
    return Scenario(
        id="reopt_case", blood_groups=("O",),
        blood_banks=(BloodBank("bank", "Bank A", "B", {"O": 5}),),
        hospitals=(Hospital("hospital", "Hospital", "H", {"O": 2},
                            {"O": Urgency("high", 1)}),),
        routes=(Route("bank", "hospital", 10, 3, 2, "available"),),
        compatibility={("O", "O"): True},
    )


class EmergencyReoptimizationTests(unittest.TestCase):
    def test_complete_greedy_reoptimization_report(self) -> None:
        original = scenario()
        event = DemandSpike("hospital", "O", 8, Urgency("critical", 3))
        report = run_emergency_reoptimization(
            original, event, ObjectiveConfig(10, 2, 1, 0.1, 0), method="greedy"
        )

        self.assertIs(report.original_scenario, original)
        self.assertEqual(report.emergency_event, event)
        self.assertEqual(report.modified_scenario.hospitals[0].demand["O"], 8)
        self.assertEqual(original.hospitals[0].demand["O"], 2)
        self.assertEqual(report.before_allocation[0].quantity, 2)
        self.assertEqual(report.after_allocation[0].quantity, 5)
        self.assertEqual(report.before_metrics.total_unmet_demand, 0)
        self.assertEqual(report.after_metrics.total_unmet_demand, 3)
        self.assertTrue(report.feasibility_status["both_feasible"])
        self.assertTrue(report.feasibility_status["before"])
        self.assertTrue(report.feasibility_status["after"])
        self.assertEqual(report.allocation_changes[("bank", "hospital", "O", "O")], 3)

    def test_qaoa_request_fails_explicitly_when_solver_is_missing(self) -> None:
        with self.assertRaisesRegex(QAOAUnavailableError, "no QAOA solver"):
            run_emergency_reoptimization(
                scenario(), DemandSpike("hospital", "O", 4),
                ObjectiveConfig(1, 1, 1, 1, 0), method="qaoa",
            )

    def test_qaoa_adapter_receives_rebuilt_before_and_after_qubos(self) -> None:
        class FixtureSampler:
            """Test double for pipeline wiring; it is not an experiment result."""

            def __init__(self):
                self.qubos = []

            def solve(self, qubo):
                self.qubos.append(qubo)
                # Construct a known feasible fixture assignment: send nothing,
                # mark every requested unit unmet, and match unused stock with
                # the builder's inventory slack bits. No bit positions are
                # assumed in this test double.
                return {"best_bitstring": tuple(
                    1 if item.kind in {"unmet", "slack"} else 0
                    for item in qubo.variable_mapping
                )}

        sampler = FixtureSampler()
        report = run_emergency_reoptimization(
            scenario(), DemandSpike("hospital", "O", 8),
            ObjectiveConfig(10, 2, 1, 0.1, 0),
            method="qaoa", qaoa_solver=sampler,
            penalty_config=QUBOPenaltyConfig(10_000, 10_000),
        )
        self.assertEqual(len(sampler.qubos), 2)
        self.assertEqual(sampler.qubos[0].scenario.hospitals[0].demand["O"], 2)
        self.assertEqual(sampler.qubos[1].scenario.hospitals[0].demand["O"], 8)
        self.assertIs(report.before_qubo, sampler.qubos[0])
        self.assertIs(report.after_qubo, sampler.qubos[1])
        self.assertTrue(report.feasibility_status["both_feasible"])


if __name__ == "__main__":
    unittest.main()
