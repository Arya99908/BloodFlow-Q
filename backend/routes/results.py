"""In-memory recent results endpoint."""

from fastapi import APIRouter, Depends

from backend.dependencies import get_service
from backend.schemas import ResultsResponse


router = APIRouter()


@router.get("/results", response_model=ResultsResponse)
def results(service=Depends(get_service)):
    return service.results()
