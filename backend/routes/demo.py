"""Controlled deterministic demonstration endpoints."""

from fastapi import APIRouter, Depends

from backend.dependencies import get_service
from backend.schemas import DemoRunRequest

router = APIRouter()


@router.get("/demo-scenarios")
def demo_scenarios(service=Depends(get_service)):
    return service.demo_scenarios()


@router.get("/experiment-defaults")
def experiment_defaults(service=Depends(get_service)):
    return service.experiment_defaults()


@router.get("/precomputed-demo")
def precomputed_demo(service=Depends(get_service)):
    """Return fixed, provenance-bearing measurements for an explicit fallback."""
    return service.precomputed_demo()


@router.post("/demo-run")
def demo_run(request: DemoRunRequest, service=Depends(get_service)):
    return service.run_demo(request)
