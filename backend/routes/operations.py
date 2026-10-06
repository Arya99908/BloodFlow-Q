"""Optimization, emergency simulation, and benchmark API endpoints."""

from fastapi import APIRouter, Depends

from backend.dependencies import get_service
from backend.schemas import (
    BenchmarkRequest,
    BenchmarkResponse,
    EmergencyRequest,
    EmergencyResponse,
    OptimizationResponse,
    OptimizeRequest,
)


router = APIRouter()


@router.post("/optimize", response_model=OptimizationResponse)
def optimize(request: OptimizeRequest, service=Depends(get_service)):
    return service.optimize(request)


@router.post("/simulate-emergency", response_model=EmergencyResponse)
def simulate_emergency(request: EmergencyRequest, service=Depends(get_service)):
    return service.simulate_emergency(request)


@router.post("/benchmark", response_model=BenchmarkResponse)
def benchmark(request: BenchmarkRequest, service=Depends(get_service)):
    return service.benchmark(request)
