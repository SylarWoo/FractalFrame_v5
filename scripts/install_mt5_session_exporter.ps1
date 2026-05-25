param(
  [string]$TerminalDataPath = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "mql5\Scripts\FractalFrameExportSymbolSessions.mq5"
if (-not (Test-Path -LiteralPath $source)) {
  throw "Exporter source not found: $source"
}

if (-not $TerminalDataPath) {
  $pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
  if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "Python executable not found: $pythonExe"
  }
  $TerminalDataPath = & $pythonExe -c "import MetaTrader5 as mt5; mt5.initialize(); info=mt5.terminal_info(); print(info.data_path if info else ''); mt5.shutdown()"
}

if (-not $TerminalDataPath) {
  throw "MT5 terminal data path not found. Pass -TerminalDataPath manually."
}

$targetDir = Join-Path $TerminalDataPath "MQL5\Scripts"
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$target = Join-Path $targetDir "FractalFrameExportSymbolSessions.mq5"
Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "Installed: $target"
Write-Host "Open MT5 MetaEditor, compile Scripts\\FractalFrameExportSymbolSessions.mq5, then run it in MT5."
