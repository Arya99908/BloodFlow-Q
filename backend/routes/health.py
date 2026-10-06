"""Health-check endpoint."""

from fastapi import APIRouter

from backend.dependencies import get_service
from backend.schemas import HealthResponse
from fastapi import Depends


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(service=Depends(get_service)):
    return service.health()
