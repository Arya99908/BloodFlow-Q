"""Reporting and telemetry API endpoints strictly deriving from synthetic data."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from backend.dependencies import get_service
from backend.reporting_service import build_reporting_telemetry
from backend.services import BackendService


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/telemetry")
def get_reporting_telemetry(
    period: str = Query(default="Last 7 days", description="Reporting period"),
    service: BackendService = Depends(get_service),
) -> dict[str, Any]:
    """Return mathematically verified reporting telemetry derived from the backend scenario.

    All stock, demand, batch, expiry, and regional figures strictly reconcile to
    the active synthetic scenario. No arbitrary numbers or Math.random() values are produced.
    """
    scenario = service._scenario(None)
    return build_reporting_telemetry(scenario, period=period)
