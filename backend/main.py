"""FastAPI application entry point for local BloodFlow-Q development."""

from __future__ import annotations

import logging
import os
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.dependencies import get_service
from backend.routes.health import router as health_router
from backend.routes.demo import router as demo_router
from backend.routes.operations import router as operations_router
from backend.routes.results import router as results_router
from backend.routes.scenario import router as scenario_router
from backend.services import APIServiceError, BackendService

logger = logging.getLogger(__name__)


DEVELOPMENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
ALLOWED_ENVIRONMENTS = {"development", "test", "production"}


def _deployment_settings(environment: str | None = None) -> tuple[str, list[str]]:
    """Read deployment mode and validate the exact browser-origin allowlist."""
    selected_environment = (environment or os.getenv("BLOODFLOW_ENV", "development")).strip().lower()
    if selected_environment not in ALLOWED_ENVIRONMENTS:
        raise RuntimeError("BLOODFLOW_ENV must be development, test, or production")

    configured_origins = os.getenv("BLOODFLOW_CORS_ORIGINS", "").strip()
    if not configured_origins:
        if selected_environment == "production":
            raise RuntimeError(
                "BLOODFLOW_CORS_ORIGINS is required in production; set the exact trusted frontend origin(s)."
            )
        return selected_environment, list(DEVELOPMENT_ORIGINS)

    origins = [origin.strip() for origin in configured_origins.split(",")]
    if not origins or any(not origin for origin in origins):
        raise RuntimeError("BLOODFLOW_CORS_ORIGINS must be a comma-separated list of exact origins")
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            "*" in origin
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise RuntimeError(
                "BLOODFLOW_CORS_ORIGINS entries must be exact origins such as https://dashboard.example.org"
            )
        if selected_environment == "production" and parsed.scheme != "https":
            raise RuntimeError("Production CORS origins must use HTTPS")
    return selected_environment, origins


def create_app(
    service: BackendService | None = None, *, environment: str | None = None
) -> FastAPI:
    """Create the app, optionally receiving a test-specific service instance."""

    selected_environment, cors_origins = _deployment_settings(environment)
    production = selected_environment == "production"

    application = FastAPI(
        title="BloodFlow-Q API",
        description=(
            "Synthetic operational logistics optimization research prototype. "
            "Not for clinical decisions or patient-level use."
        ),
        version="0.1.0",
        debug=False,
        docs_url=None if production else "/docs",
        redoc_url=None if production else "/redoc",
        openapi_url=None if production else "/openapi.json",
    )
    application.state.service = service or BackendService()
    application.state.environment = selected_environment
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        # The prototype uses no cookie or session authentication, so browser
        # credential sharing is unnecessary and stays disabled.
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @application.exception_handler(APIServiceError)
    async def handle_service_error(_request: Request, error: APIServiceError):
        detail = error.detail
        if production and error.status_code >= 500:
            detail = f"The request failed ({error.code}). Contact the service operator."
        return JSONResponse(
            status_code=error.status_code,
            content={"error": error.code, "detail": detail},
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, error: RequestValidationError):
        messages = [
            {"location": list(item.get("loc", ())), "message": item.get("msg", "invalid value")}
            for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"error": "validation_error", "detail": messages},
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, error: Exception):
        # Never expose traceback, local paths, or internal exception content.
        logger.error("Unhandled API exception", exc_info=error)
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error",
                     "detail": "The request could not be completed. Please check the input or retry."},
        )

    application.include_router(health_router)
    application.include_router(demo_router)
    application.include_router(scenario_router)
    application.include_router(operations_router)
    application.include_router(results_router)
    return application


app = create_app()
