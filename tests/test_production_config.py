"""Production-mode configuration and error-boundary checks."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.services import APIServiceError


class ProductionConfigurationTests(unittest.TestCase):
    def test_production_requires_an_explicit_cors_origin(self) -> None:
        with patch.dict(os.environ, {"BLOODFLOW_CORS_ORIGINS": ""}):
            with self.assertRaisesRegex(RuntimeError, "required in production"):
                create_app(environment="production")

    def test_production_accepts_only_configured_https_frontend_origin(self) -> None:
        with patch.dict(os.environ, {"BLOODFLOW_CORS_ORIGINS": "https://dashboard.example.org"}):
            app = create_app(environment="production")
        self.assertFalse(app.debug)
        client = TestClient(app)

        allowed = client.options("/health", headers={
            "Origin": "https://dashboard.example.org",
            "Access-Control-Request-Method": "GET",
        })
        self.assertEqual(allowed.headers.get("access-control-allow-origin"),
                         "https://dashboard.example.org")
        self.assertIsNone(allowed.headers.get("access-control-allow-credentials"))

        denied = client.options("/health", headers={
            "Origin": "https://other.example.org",
            "Access-Control-Request-Method": "GET",
        })
        self.assertNotEqual(denied.headers.get("access-control-allow-origin"),
                            "https://other.example.org")
        self.assertEqual(client.get("/docs").status_code, 404)
        self.assertEqual(client.get("/openapi.json").status_code, 404)

    def test_production_rejects_wildcard_and_insecure_origins(self) -> None:
        for origin in ("*", "https://*.example.org", "http://dashboard.example.org", "https://dashboard.example.org/path"):
            with self.subTest(origin=origin), patch.dict(os.environ, {"BLOODFLOW_CORS_ORIGINS": origin}):
                with self.assertRaises(RuntimeError):
                    create_app(environment="production")

    def test_production_api_errors_do_not_echo_internal_details(self) -> None:
        with patch.dict(os.environ, {"BLOODFLOW_CORS_ORIGINS": "https://dashboard.example.org"}):
            app = create_app(environment="production")

        @app.get("/private-error-test")
        def private_error():
            raise APIServiceError(502, "private path /srv/app and secret diagnostic", "qaoa_failure")

        response = TestClient(app).get("/private-error-test")
        self.assertEqual(response.status_code, 502)
        self.assertIn("qaoa_failure", response.json()["detail"])
        self.assertNotIn("/srv/app", response.text)
        self.assertNotIn("secret diagnostic", response.text)


if __name__ == "__main__":
    unittest.main()
