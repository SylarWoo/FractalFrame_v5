param(
  [string]$HostAddress = "127.0.0.1",
  [int]$Port = 5185,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$repoRootPattern = ($repoRoot -replace "\\", "/")
$frontendRoot = Join-Path $repoRoot "frontend"

function Stop-RepoFrontendProcess {
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $commandLine = ($_.CommandLine -replace "\\", "/")
      $commandLine -like "*$repoRootPattern/frontend*" -and $commandLine -like "*vite*"
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

function Wait-RepoFrontendExit {
  param([int]$TimeoutMilliseconds = 2500)
  $deadline = (Get-Date).AddMilliseconds($TimeoutMilliseconds)
  do {
    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $commandLine = ($_.CommandLine -replace "\\", "/")
        $commandLine -like "*$repoRootPattern/frontend*" -and $commandLine -like "*vite*"
      }
    if (-not $processes) { return }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
}

Stop-RepoFrontendProcess
Stop-RepoPortProcess -TargetPort $Port
Wait-RepoFrontendExit
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  throw "Port $Port is already in use."
}
if ($OpenBrowser) {
  Start-Process "http://$HostAddress`:$Port"
}
Push-Location $frontendRoot
try {
  npm run dev -- --host $HostAddress --port $Port
} finally {
  Pop-Location
}
