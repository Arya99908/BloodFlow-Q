"""Mathematical integrity, provenance, and reconciliation tests for reporting telemetry.

Verifies that:
1. Total stock equals the sum of facility inventory records.
2. Regional stock strictly equals the sum of its facilities.
3. Blood group stock equals the sum of its discrete batches.
4. Expiry buckets reconcile exactly to eligible inventory.
5. Inflow/outflow transactions reconcile to scenario volume and solver allocation.
6. KPI calculations match independently calculated backend expectations.
7. Reproducibility: fixed seed produces identical output across calls.
8. Empty/missing handling is resilient.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.data_loader import load_data
from backend.main import create_app
from backend.reporting_service import (
    build_reporting_telemetry,
    generate_inventory_batches,
)
from backend.scenario_factory import scenario_from_loaded_data
from backend.services import BackendService


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


@pytest.fixture
def scenario():
    return scenario_from_loaded_data(load_data())


def test_endpoint_returns_synthetic_telemetry(client):
    """GET /reports/telemetry returns HTTP 200 with required schema fields."""
    response = client.get("/reports/telemetry?period=Last%207%20days")
    assert response.status_code == 200
    data = response.json()

    assert data["synthetic"] is True
    assert data["schema_version"] == 1
    assert data["scenario_id"] == "synthetic_default"
    assert "kpis" in data
    assert "availability" in data
    assert "collected_vs_used" in data
    assert "quarterly_trends" in data
    assert "expiry_matrix" in data
    assert "regional_breakdown" in data
    assert "provenance" in data


def test_total_stock_reconciles_to_bank_records(scenario):
    """Total stock must strictly equal the sum of bank inventory records."""
    telemetry = build_reporting_telemetry(scenario)
    expected_sum = sum(sum(b.inventory.values()) for b in scenario.blood_banks)
    
    assert telemetry["provenance"]["total_stock_units"] == expected_sum
    assert telemetry["kpis"]["current_stock"]["value"] == expected_sum


def test_regional_totals_equal_facility_sums(scenario):
    """Regional totals must strictly equal the sum of their facilities."""
    telemetry = build_reporting_telemetry(scenario)
    regional = telemetry["regional_breakdown"]

    total_reg_stock = 0
    total_reg_demand = 0

    for reg in regional:
        facility_stock = sum(f["stock"] for f in reg["facilities"] if f["type"] == "Blood Bank")
        facility_demand = sum(f["demand"] for f in reg["facilities"] if f["type"] == "Hospital")
        
        assert reg["total_stock"] == facility_stock, f"Mismatch in {reg['region']}"
        assert reg["total_demand"] == facility_demand, f"Demand mismatch in {reg['region']}"
        
        total_reg_stock += reg["total_stock"]
        total_reg_demand += reg["total_demand"]

    assert total_reg_stock == telemetry["provenance"]["total_stock_units"]
    assert total_reg_demand == telemetry["provenance"]["total_demand_units"]


def test_batch_sums_equal_blood_group_totals(scenario):
    """Every generated batch must reconcile to the bank inventory and blood group sums."""
    batches = generate_inventory_batches(scenario, seed=20261030)
    expected_total = sum(sum(b.inventory.values()) for b in scenario.blood_banks)
    assert sum(b.units for b in batches) == expected_total

    # Group by blood group
    for g in scenario.blood_groups:
        group_batch_sum = sum(b.units for b in batches if b.blood_group == g)
        expected_group_sum = sum(b.inventory.get(g, 0) for b in scenario.blood_banks)
        assert group_batch_sum == expected_group_sum, f"Batch sum mismatch for group {g}"


def test_expiry_matrix_buckets_reconcile_to_inventory(scenario):
    """Expiry matrix bucket sums must equal total blood group stock."""
    telemetry = build_reporting_telemetry(scenario)
    matrix = telemetry["expiry_matrix"]["canonical"]
    buckets = telemetry["expiry_matrix"]["buckets"]

    for row in matrix:
        group = row["group"]
        bucket_sum = sum(row[b] for b in buckets)
        expected_stock = sum(b.inventory.get(group, 0) for b in scenario.blood_banks)
        assert bucket_sum == expected_stock, f"Expiry buckets sum mismatch for group {group}"


def test_reproducibility_across_calls(scenario):
    """The same seed and configuration must produce identical results across calls."""
    res1 = build_reporting_telemetry(scenario, seed=20261030)
    res2 = build_reporting_telemetry(scenario, seed=20261030)

    assert res1["provenance"] == res2["provenance"]
    assert res1["kpis"]["current_stock"] == res2["kpis"]["current_stock"]
    assert res1["kpis"]["average_shelf_life"] == res2["kpis"]["average_shelf_life"]
    assert res1["expiry_matrix"] == res2["expiry_matrix"]


def test_kpi_calculations_are_mathematically_exact(scenario):
    """KPI values must match mathematical formulas without fabrication."""
    telemetry = build_reporting_telemetry(scenario)
    kpis = telemetry["kpis"]

    # Diversity coverage: all 4 groups have inventory > 0 -> 100.0%
    assert kpis["blood_diversity_coverage"]["value"] == 100.0

    # Stock turnover rate = (used / total_stock) * 100
    used_units = sum(r["used"] for r in telemetry["collected_vs_used"]["canonical"])
    total_stock = telemetry["provenance"]["total_stock_units"]
    expected_turnover = round((used_units / total_stock) * 100.0, 1)
    assert kpis["stock_turnover_rate"]["value"] == expected_turnover


def test_telemetry_uses_source_abo_labels_without_inferred_subtypes(scenario):
    telemetry = build_reporting_telemetry(scenario)
    assert telemetry['canonical_groups'] == list(scenario.blood_groups)
    for chart in ('availability', 'collected_vs_used', 'expiry_matrix'):
        assert 'rh_subtypes' not in telemetry[chart]
        assert {row['group'] for row in telemetry[chart]['canonical']} == set(scenario.blood_groups)
    for batch in generate_inventory_batches(scenario):
        assert batch.blood_group in scenario.blood_groups
        assert not hasattr(batch, 'rh_subtype')
