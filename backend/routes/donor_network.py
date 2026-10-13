"""Synthetic coordination endpoints kept separate from the optimizer API."""

from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import Field

from backend.dependencies import get_service
from backend.schemas import StrictModel


router = APIRouter(prefix="/coordination", tags=["coordination"])


class DemoAction(StrictModel):
    """An allowed non-identifying step in a synthetic demo."""

    action: Literal[
        "accept_donor", "decline_donor", "arrange_appointment",
        "confirm_collection", "begin_testing", "confirm_testing_and_release",
        "assign_transport", "confirm_dispatch", "confirm_receipt", "complete",
    ]
    donor_id: str | None = Field(default=None, max_length=80)


class DemoActionRequest(StrictModel):
    """A single click in the deterministic, explicitly simulated workflow."""

    actions: list[DemoAction] = Field(default_factory=list, max_length=20)
    action: Literal[
        "accept_donor", "decline_donor", "arrange_appointment",
        "confirm_collection", "begin_testing", "confirm_testing_and_release",
        "assign_transport", "confirm_dispatch", "confirm_receipt", "complete",
    ]
    donor_id: str | None = Field(default=None, max_length=80)


@router.get("/capabilities")
def capabilities(service=Depends(get_service)):
    """Report honestly which coordination capabilities are configured.

    The existing deployment has no identity provider or donor database. The
    live personal-data features therefore fail closed; the safe synthetic
    walkthrough remains available without account credentials.
    """

    return service.donor_network_capabilities()


@router.get("/dashboard")
def dashboard(service=Depends(get_service)):
    """Return unavailable counts as null rather than implying empty records."""

    return service.donor_network_dashboard()


@router.post("/demo/start")
def start_emergency_demo(service=Depends(get_service)):
    """Start the deterministic synthetic request without writing a database."""

    return service.start_coordination_demo()


@router.post("/demo/action")
def advance_emergency_demo(request: DemoActionRequest, service=Depends(get_service)):
    """Advance one simulated workflow action; never call a live optimizer."""

    action_log = [item.model_dump() for item in request.actions]
    return service.advance_coordination_demo(action_log, request.action, request.donor_id)
