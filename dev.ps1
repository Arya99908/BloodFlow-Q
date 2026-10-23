# Run both the BloodFlow-Q Backend and Frontend concurrently on Windows.
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

if (Test-Path "C:\Program Files\nodejs") {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
}

$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Error "Virtual environment missing. Run .\setup.ps1 first."
    exit 1
}

$FrontendModules = Join-Path $ProjectRoot "frontend\node_modules"
if (-not (Test-Path $FrontendModules)) {
    Write-Error "Frontend node_modules missing. Run .\setup.ps1 first."
    exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Launching BloodFlow-Q Local Development Services" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Backend API:      http://127.0.0.1:8000" -ForegroundColor White
Write-Host "API Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "Frontend Website: http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Git Push Status:  LOCKED (Changes cannot be pushed to remote)" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop all servers.`n" -ForegroundColor Gray

# Start backend job
$BackendJob = Start-Job -ScriptBlock {
    param($Root)
    Set-Location $Root
    $py = Join-Path $Root ".venv\Scripts\python.exe"
    & $py -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $ProjectRoot

# Start frontend job
$FrontendJob = Start-Job -ScriptBlock {
    param($Root)
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
    Set-Location (Join-Path $Root "frontend")
    npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
} -ArgumentList $ProjectRoot

try {
    while ($true) {
        Receive-Job $BackendJob | ForEach-Object { Write-Host "[Backend]  $_" -ForegroundColor DarkCyan }
        Receive-Job $FrontendJob | ForEach-Object { Write-Host "[Frontend] $_" -ForegroundColor DarkGreen }

        if ($BackendJob.State -eq 'Failed' -or $FrontendJob.State -eq 'Failed') {
            break
        }
        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host "`nStopping local servers..." -ForegroundColor Yellow
    Stop-Job $BackendJob -ErrorAction SilentlyContinue
    Remove-Job $BackendJob -ErrorAction SilentlyContinue
    Stop-Job $FrontendJob -ErrorAction SilentlyContinue
    Remove-Job $FrontendJob -ErrorAction SilentlyContinue
    Write-Host "Servers stopped." -ForegroundColor Green
}
