param(
  [string]$HostAddress = "127.0.0.1",
  [int]$BackendPort = 8765,
  [int]$FrontendPort = 5185,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRootPattern = ($repoRoot -replace "\\", "/")
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"

function Stop-RepoBackendProcess {
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $commandLine = ($_.CommandLine -replace "\\", "/")
      $commandLine -like "*$repoRootPattern*" -and $commandLine -like "*scripts/mt5_symbols_server.py*"
    }
  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-RepoPortProcess {
  param([int]$TargetPort)
  $listeners = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = if ($process) { ($process.CommandLine -replace "\\", "/") } else { "" }
    if ($process -and $commandLine -like "*$repoRootPattern*") {
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-RepoBackendProcess
Stop-RepoPortProcess -TargetPort $BackendPort
Stop-RepoPortProcess -TargetPort $FrontendPort
Start-Sleep -Milliseconds 300
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
