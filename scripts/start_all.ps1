param(
  [string]$HostAddress = "127.0.0.1",
  [int]$BackendPort = 8765,
  [int]$FrontendPort = 5185,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$backendBusy = Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue
$frontendBusy = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue
if ($backendBusy) { throw "Backend port $BackendPort is already in use." }
if ($frontendBusy) { throw "Frontend port $FrontendPort is already in use." }

$backend = Start-Process `
  -FilePath $pythonExe `
  -ArgumentList @("scripts\mt5_symbols_server.py", "--host", $HostAddress, "--port", [string]$BackendPort) `
  -WorkingDirectory $repoRoot `
  -PassThru `
  -WindowStyle Hidden

try {
  if ($OpenBrowser) {
    Start-Process "http://$HostAddress`:$FrontendPort"
  }
  Push-Location (Join-Path $repoRoot "frontend")
  try {
    npm run dev -- --host $HostAddress --port $FrontendPort
  } finally {
    Pop-Location
  }
} finally {
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  }
}
