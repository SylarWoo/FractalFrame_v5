param(
  [string]$HostAddress = "127.0.0.1",
  [int]$Port = 8765,
  [string]$Symbol = "XAUUSDm",
  [int]$PullCount = 2000,
  [switch]$RunPull
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$baseUrl = "http://$HostAddress`:$Port"
$server = $null

function Invoke-JsonGet {
  param([string]$Path)
  $url = "$baseUrl$Path"
  Write-Host "GET $url"
  $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 30
  $payload = $response.Content | ConvertFrom-Json
  if ($payload.ok -eq $false) {
    throw "Request failed: $url -> $($response.Content)"
  }
  return $payload
}

function Wait-Bridge {
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/api/market-data/v1/store-v5/status" -TimeoutSec 2 | Out-Null
    } catch {
      $statusCode = $_.Exception.Response.StatusCode.value__
      if ($statusCode -eq 400) { return }
    }
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for bridge at $baseUrl"
}

if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Python executable not found: $pythonExe"
}

try {
  $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if (-not $existing) {
    $server = Start-Process `
      -FilePath $pythonExe `
      -ArgumentList @("scripts\mt5_symbols_server.py", "--host", $HostAddress, "--port", [string]$Port) `
      -WorkingDirectory $repoRoot `
      -PassThru `
      -WindowStyle Hidden
  }

  Wait-Bridge
  Invoke-JsonGet "/api/market-data/v1/mt5/symbols?limit=5" | Out-Null
  Invoke-JsonGet "/api/market-data/v1/store-v5/status?symbol=$Symbol" | Out-Null

  if ($RunPull) {
    Invoke-JsonGet "/api/market-data/v1/store-v5/pull?symbol=$Symbol&mode=refresh&count=$PullCount" | Out-Null
    Invoke-JsonGet "/api/market-data/v1/store-v5/query?symbol=$Symbol&timeframe=M1&limit=10" | Out-Null
    Invoke-JsonGet "/api/market-data/v1/store-v5/aggregate?symbol=$Symbol&timeframes=M5,H1&rebuild=1" | Out-Null
  }

  Write-Host "Live MT5/StoreV5 check passed."
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
}
