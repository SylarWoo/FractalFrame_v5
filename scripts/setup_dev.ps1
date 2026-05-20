$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"

Push-Location $repoRoot
try {
  if (-not (Test-Path -LiteralPath $pythonExe)) {
    py -3 -m venv .venv
  }

  & $pythonExe -m pip install --upgrade pip
  & $pythonExe -m pip install -r requirements.txt
  if (Test-Path -LiteralPath "requirements-dev.txt") {
    & $pythonExe -m pip install -r requirements-dev.txt
  }

  Push-Location "frontend"
  try {
    npm install
  } finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "Setup complete."
  Write-Host "Backend: .\.venv\Scripts\python.exe scripts\mt5_symbols_server.py --host 127.0.0.1 --port 8765"
  Write-Host "Frontend: cd frontend; npm run dev -- --host 127.0.0.1 --port 5185"
} finally {
  Pop-Location
}
