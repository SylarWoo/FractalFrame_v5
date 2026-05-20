$ErrorActionPreference = 'Stop'

$port = 4173
$hostAddress = '127.0.0.1'
$url = "http://$hostAddress`:$port"
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($existing) {
  throw "Port $port is already in use. Stop the existing server or change frontend/playwright.config.ts."
}

$server = Start-Process `
  -FilePath 'npm' `
  -ArgumentList @('run', 'dev', '--', '--host', $hostAddress, '--port', [string]$port) `
  -WorkingDirectory $PSScriptRoot\.. `
  -PassThru `
  -WindowStyle Hidden

try {
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 500
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        break
      }
    } catch {
      if ((Get-Date) -ge $deadline) {
        throw
      }
    }
  } while ((Get-Date) -lt $deadline)

  if ((Get-Date) -ge $deadline) {
    throw "Timed out waiting for Vite dev server at $url."
  }

  & npx playwright test
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }

  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
  }

  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*vite --host $hostAddress --port $port*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
