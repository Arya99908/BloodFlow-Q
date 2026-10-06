"""FastAPI dependencies shared by the route modules."""

from fastapi import Request

from backend.services import BackendService


def get_service(request: Request) -> BackendService:
    """Return the service instance attached to this application."""

    return request.app.state.service
