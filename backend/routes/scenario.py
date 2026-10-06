"""Read-only access to the bundled synthetic scenario."""

from fastapi import APIRouter, Depends

from backend.dependencies import get_service
from backend.schemas import ScenarioInput


router = APIRouter()


@router.get("/scenario", response_model=ScenarioInput)
def get_scenario(service=Depends(get_service)):
    return service.get_scenario()
