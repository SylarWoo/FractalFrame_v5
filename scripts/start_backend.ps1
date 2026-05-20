param(
  [string]$HostAddress = "127.0.0.1",
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Python executable not found: $pythonExe"
}
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  throw "Port $Port is already in use."
}
& $pythonExe scripts\mt5_symbols_server.py --host $HostAddress --port $Port
