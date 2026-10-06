"""Print a hand-checkable one-bank, one-hospital QUBO (no solver is run)."""

from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.qubo import QUBOPenaltyConfig, build_qubo


scenario = Scenario(
    id="one_unit_example",
    blood_groups=("O",),
    blood_banks=(BloodBank("bank", "Bank A", "B", {"O": 1}),),
    hospitals=(Hospital("hospital", "Hospital 1", "H", {"O": 1},
                        {"O": Urgency("high", 1)}),),
    routes=(Route("bank", "hospital", 0, 0, 0, "available"),),
    compatibility={("O", "O"): True},
)
result = build_qubo(
    scenario,
    ObjectiveConfig(2, 1, 0, 0, 0),
    QUBOPenaltyConfig(inventory_penalty_weight=4, demand_penalty_weight=4),
)

print("Variable order:", [(item.index, item.kind, item.decision_meaning)
                           for item in result.variable_mapping])
print("Q:")
for row in result.matrix:
    print(row)
print("Constant offset:", result.constant_offset)
print("Shipping all units energy:", result.energy((1, 0, 0)))
print("Leaving demand unmet energy:", result.energy((0, 1, 1)))
