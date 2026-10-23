# Start the BloodFlow-Q Vite frontend on Windows.
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

if (Test-Path "C:\Program Files\nodejs") {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
}

$FrontendDir = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Error "node_modules not found in $FrontendDir. Run .\setup.ps1 first."
    exit 1
}

$HostName = if ($env:BLOODFLOW_FRONTEND_HOST) { $env:BLOODFLOW_FRONTEND_HOST } else { "127.0.0.1" }
$Port = if ($env:BLOODFLOW_FRONTEND_PORT) { $env:BLOODFLOW_FRONTEND_PORT } else { "5173" }

Set-Location $FrontendDir
Write-Host "Starting BloodFlow-Q Frontend at http://$HostName`:$Port" -ForegroundColor Green

npm run dev -- --host $HostName --port $Port --strictPort
