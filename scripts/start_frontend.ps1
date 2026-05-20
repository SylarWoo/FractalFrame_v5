param(
  [string]$HostAddress = "127.0.0.1",
  [int]$Port = 5185,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"
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
