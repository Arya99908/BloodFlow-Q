# Local setup script for Windows PowerShell
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "Setting up BloodFlow-Q local development environment..." -ForegroundColor Cyan

# 1. Ensure Python virtual environment
$VenvPython = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating Python virtual environment in .venv..." -ForegroundColor Yellow
    py -3.13 -m venv (Join-Path $ProjectRoot ".venv")
}

# 2. Install Python requirements
Write-Host "Installing Python dependencies from requirements.txt..." -ForegroundColor Yellow
& $VenvPython -m pip install --disable-pip-version-check -r (Join-Path $ProjectRoot "requirements.txt")

# 3. Ensure Node.js is in PATH
if (Test-Path "C:\Program Files\nodejs") {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
}

# 4. Install npm packages
Write-Host "Installing frontend packages with npm..." -ForegroundColor Yellow
Set-Location (Join-Path $ProjectRoot "frontend")
npm ci

Set-Location $ProjectRoot
Write-Host "`nSetup complete! Run .\dev.ps1 to start the website locally." -ForegroundColor Green
