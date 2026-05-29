$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$env:NPM_CONFIG_MIN_RELEASE_AGE = $null

function Invoke-Check {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Python executable not found: $pythonExe"
}

Push-Location $repoRoot
try {
  Invoke-Check "Python unit tests" {
    & $pythonExe -m unittest tests.test_store_v5 tests.test_http_bridge_helpers tests.test_mmf_v2_regression
  }

  Invoke-Check "Python compile check" {
    & $pythonExe -m compileall -q scripts\mt5_symbols_server.py scripts\http_bridge
  }

  Push-Location $frontendRoot
  try {
    Invoke-Check "Frontend lint" {
      npm run lint
    }

    Invoke-Check "Frontend logic tests" {
      npm run test:logic
    }

    Invoke-Check "Frontend e2e smoke" {
      npm run test:e2e
    }

    Invoke-Check "Frontend production build" {
      npm run build
    }
  } finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "All checks passed."
} finally {
  Pop-Location
}
