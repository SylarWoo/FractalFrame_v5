param(
  [string]$HostAddress = "127.0.0.1",
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRootPattern = ($repoRoot -replace "\\", "/")
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Python executable not found: $pythonExe"
}

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

function Wait-RepoBackendExit {
  param([int]$TimeoutMilliseconds = 2500)
  $deadline = (Get-Date).AddMilliseconds($TimeoutMilliseconds)
  do {
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $commandLine = ($_.CommandLine -replace "\\", "/")
        $commandLine -like "*$repoRootPattern*" -and $commandLine -like "*scripts/mt5_symbols_server.py*"
      }
    if (-not $processes) { return }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
}

Stop-RepoBackendProcess
Stop-RepoPortProcess -TargetPort $Port
Wait-RepoBackendExit
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  throw "Port $Port is already in use."
}
& $pythonExe scripts\mt5_symbols_server.py --host $HostAddress --port $Port
