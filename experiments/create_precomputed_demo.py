"""Capture real compact-demo API runs as an explicitly precomputed artifact.

Run from the project root with ``python3 -m experiments.create_precomputed_demo``.
The script fails if the destination already exists; keep each capture immutable.
It never manufactures solver output or substitutes a classical answer for QAOA.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from backend.main import create_app


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "experiments" / "precomputed" / "hackathon_demo.json"
QAOA_CONFIG = {
    "p": 1,
    "shots": 256,
    "optimizer": "COBYLA",
    "max_iterations": 10,
    "seed": 7,
}
OBJECTIVE_WEIGHTS = {
    "critical_unmet_weight": 10.0,
    "total_unmet_weight": 5.0,
    "transportation_cost_weight": 1.0,
    "transportation_time_weight": 0.1,
    "secondary_penalty_weight": 0.0,
}
PENALTY_WEIGHTS = {
    "inventory_penalty_weight": 10_000.0,
    "demand_penalty_weight": 10_000.0,
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_versions() -> dict[str, str | None]:
    names = ("fastapi", "httpx", "numpy", "qiskit", "qiskit-aer", "scipy")
    versions: dict[str, str | None] = {}
    for name in names:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = None
    return versions


def capture(client: TestClient, scenario_id: str, method: str) -> dict[str, Any]:
    request: dict[str, Any] = {
        "scenario_id": scenario_id,
        "method": method,
        "objective_weights": OBJECTIVE_WEIGHTS,
        "exact_max_candidate_states": 50_000,
    }
    if method == "qaoa":
        request["qaoa_config"] = QAOA_CONFIG
        request["qaoa_penalties"] = PENALTY_WEIGHTS

    started = datetime.now(timezone.utc).isoformat()
    response = client.post("/demo-run", json=request)
    if response.status_code != 200:
        raise RuntimeError(
            f"Real {method} run for {scenario_id} failed with HTTP "
            f"{response.status_code}: {response.text}"
        )
    measured = response.json()
    if measured.get("method") != method or measured.get("scenario_id") != scenario_id:
        raise RuntimeError("The API returned a mismatched scenario or method; capture stopped.")
    return {
        "run_id": f"{scenario_id}-{method}",
        "scenario_id": scenario_id,
        "method": method,
        "timestamp_utc": started,
        "configuration": measured["experiment_configuration"],
        "result": measured,
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        raise SystemExit(f"Refusing to overwrite existing experiment artifact: {OUTPUT}")

    client = TestClient(create_app())
    runs = [
        capture(client, "normal", "greedy"),
        capture(client, "normal", "exact"),
        capture(client, "normal", "qaoa"),
        capture(client, "emergency_demand_spike", "qaoa"),
    ]

    source_paths = [
        "experiments/create_precomputed_demo.py",
        "backend/demo_scenarios.py", "backend/services.py", "backend/schemas.py",
        "backend/main.py", "backend/dependencies.py", "backend/scenario_factory.py",
        "backend/routes/demo.py", "requirements.txt",
        "optimization/models.py", "optimization/objective.py", "optimization/constraints.py",
        "optimization/decoder.py", "optimization/greedy.py", "optimization/exact.py",
        "optimization/benchmark.py", "emergency/simulator.py", "emergency/reoptimization.py",
        "quantum/qubo.py", "quantum/ising.py", "quantum/qaoa_solver.py",
        "data/blood_banks.json", "data/hospitals.json", "data/routes.json", "data/compatibility.json",
    ]
    reproducibility = {
        "command": "python3 -m experiments.create_precomputed_demo",
        "python_version": sys.version,
        "platform": platform.platform(),
        "packages": package_versions(),
        "source_files_sha256": {
            name: sha256_file(ROOT / name) for name in source_paths
        },
        "qaoa_configuration": QAOA_CONFIG,
        "objective_weights": OBJECTIVE_WEIGHTS,
        "qubo_penalty_weights": PENALTY_WEIGHTS,
        "note": (
            "Each result is the unmodified response from the local FastAPI demo endpoint. "
            "QAOA rows were executed on the configured local simulator during capture. "
            "Timings describe that capture environment and are not live performance claims."
        ),
    }
    for run in runs:
        run["reproducibility"] = reproducibility

    artifact = {
        "record_type": "bloodflow_precomputed_demo",
        "label": "PRECOMPUTED EXPERIMENT",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "synthetic_data_only": True,
        "runs": runs,
        "reproducibility": reproducibility,
    }
    data = (json.dumps(artifact, indent=2, sort_keys=True) + "\n").encode("utf-8")
    try:
        descriptor = os.open(OUTPUT, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError as error:
        raise SystemExit(f"Refusing to overwrite existing experiment artifact: {OUTPUT}") from error
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    print(f"Saved {len(runs)} measured runs to {OUTPUT.relative_to(ROOT)}")
    for run in runs:
        print(f"- {run['run_id']}: captured {run['timestamp_utc']}")


if __name__ == "__main__":
    main()
