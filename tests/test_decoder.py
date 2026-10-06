"""Tests for mapping-driven QAOA bitstring decoding."""

from __future__ import annotations

import unittest

from optimization.decoder import DecoderInputError, decode_qaoa_bitstring
from optimization.models import BloodBank, Hospital, Route, Scenario, Urgency
from optimization.objective import ObjectiveConfig
from quantum.qubo import QUBOPenaltyConfig, build_qubo


def one_unit_qubo():
    scenario = Scenario(
        id="decoder_example",
        blood_groups=("O",),
        blood_banks=(BloodBank("bank_a", "Bank A", "B", {"O": 1}),),
        hospitals=(Hospital("hospital_1", "Hospital 1", "H", {"O": 1},
                            {"O": Urgency("high", 1)}),),
        routes=(Route("bank_a", "hospital_1", 25, 12, 7.5, "available"),),
        compatibility={("O", "O"): True},
    )
    return build_qubo(
        scenario,
        ObjectiveConfig(2, 1, 1, 0.1, 0),
        QUBOPenaltyConfig(20, 20),
    )


class DecoderTests(unittest.TestCase):
    def test_known_qiskit_count_key_decodes_to_expected_shipment(self) -> None:
        qubo = one_unit_qubo()
        self.assertEqual([item.kind for item in qubo.variable_mapping],
                         ["allocation", "unmet", "slack"])

        # Qiskit displays the highest-index bit first: "001" selects mapping
        # index zero, which the builder says is the shipment variable.
        result = decode_qaoa_bitstring(qubo, "001")

        self.assertEqual(result.bits_in_mapping_order, (1, 0, 0))
        self.assertEqual(len(result.selected_variables), 1)
        self.assertEqual(result.selected_variables[0].kind, "allocation")
        self.assertEqual(result.selected_variables[0].quantity_contribution, 1)
        self.assertEqual(result.selected_variables[0].route, "bank_a -> hospital_1")
        self.assertEqual(result.selected_variables[0].route_travel_time_minutes, 25)
        self.assertEqual(result.selected_variables[0].route_transport_cost, 7.5)
        self.assertEqual(len(result.allocations), 1)
        shipment = result.allocations[0]
        self.assertEqual(shipment.blood_bank, "Bank A")
        self.assertEqual(shipment.blood_bank_id, "bank_a")
        self.assertEqual(shipment.hospital, "Hospital 1")
        self.assertEqual(shipment.hospital_id, "hospital_1")
        self.assertEqual(shipment.blood_group, "O")
        self.assertEqual(shipment.recipient_group, "O")
        self.assertEqual(shipment.quantity, 1)
        self.assertEqual(shipment.decision, "ship 1 unit(s)")
        self.assertEqual(shipment.route, "bank_a -> hospital_1")
        self.assertEqual(shipment.route_travel_time_minutes, 25)
        self.assertEqual(shipment.route_transport_cost, 7.5)
        self.assertEqual(shipment.shipment_travel_time_minutes, 25)
        self.assertEqual(shipment.shipment_transport_cost, 7.5)

    def test_integer_sequence_is_in_mapping_index_order(self) -> None:
        qubo = one_unit_qubo()
        result = decode_qaoa_bitstring(qubo, (1, 0, 0))
        self.assertEqual(result.bits_in_mapping_order, (1, 0, 0))
        self.assertEqual(result.allocations[0].quantity, 1)

    def test_mapping_order_text_can_be_requested_explicitly(self) -> None:
        qubo = one_unit_qubo()
        result = decode_qaoa_bitstring(qubo, "100", string_bit_order="mapping")
        self.assertEqual(result.bits_in_mapping_order, (1, 0, 0))

    def test_bad_length_or_non_binary_value_is_rejected(self) -> None:
        qubo = one_unit_qubo()
        with self.assertRaisesRegex(DecoderInputError, "expected 3 bits"):
            decode_qaoa_bitstring(qubo, "01")
        with self.assertRaisesRegex(DecoderInputError, "only '0' and '1'"):
            decode_qaoa_bitstring(qubo, "0a1")
        with self.assertRaisesRegex(DecoderInputError, "every value must be 0 or 1"):
            decode_qaoa_bitstring(qubo, (0, 2, 0))

    def test_zero_shipment_candidate_returns_no_allocation_rows(self) -> None:
        result = decode_qaoa_bitstring(one_unit_qubo(), "000")
        self.assertEqual(result.allocations, ())
        self.assertEqual(result.unmet_demand[("hospital_1", "O")], 0)


if __name__ == "__main__":
    unittest.main()
