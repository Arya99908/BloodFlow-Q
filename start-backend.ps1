# Start the BloodFlow-Q FastAPI backend on Windows using the local virtual environment.
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Error "Virtual environment not found at $Python. Run .\setup.ps1 first."
    exit 1
}

$HostName = if ($env:BLOODFLOW_API_HOST) { $env:BLOODFLOW_API_HOST } else { "127.0.0.1" }
$Port = if ($env:BLOODFLOW_API_PORT) { $env:BLOODFLOW_API_PORT } else { "8000" }

Set-Location $ProjectRoot
Write-Host "Starting BloodFlow-Q API at http://$HostName`:$Port" -ForegroundColor Cyan
Write-Host "Interactive API Docs at http://$HostName`:$Port/docs" -ForegroundColor Gray

& $Python -m uvicorn backend.main:app --reload --host $HostName --port $Port
