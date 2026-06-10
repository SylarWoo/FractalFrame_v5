param(
  [Parameter(Mandatory = $true)]
  [string]$LauncherPath,

  [int]$DurationSeconds = 90,

  [int]$SampleMs = 1000
)

$ErrorActionPreference = 'Stop'

function Get-TrackedFiles {
  param(
    [string[]]$Roots,
    [datetime]$Since
  )

  $results = @()
  foreach ($root in @($Roots)) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    $results += Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -ge $Since } |
      Sort-Object LastWriteTime -Descending |
      Select-Object FullName, DirectoryName, Length, LastWriteTime
  }
  $results
}

function Get-BattleNetProcesses {
  param(
    [string]$LauncherDir
  )

  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($LauncherDir, [System.StringComparison]::OrdinalIgnoreCase)) -or
      $_.Name -match 'Battle\.net|Agent'
    } |
    Select-Object ProcessId, ParentProcessId, Name, ExecutablePath
}

function Get-ProcessIoSnapshot {
  param(
    [int[]]$ProcessIds
  )

  $snapshot = @{}
  foreach ($processId in @($ProcessIds)) {
    try {
      $proc = Get-Process -Id $processId -ErrorAction Stop
      $snapshot[$processId] = [pscustomobject]@{
        Id = $processId
        Name = $proc.ProcessName
        StartTime = $proc.StartTime
        IOReadBytes = [int64]$proc.IOReadBytes
        IOWriteBytes = [int64]$proc.IOWriteBytes
        PM = [int64]$proc.PagedMemorySize64
        WS = [int64]$proc.WorkingSet64
      }
    } catch {
    }
  }
  $snapshot
}

function Get-GDiskCounters {
  $paths = @(
    '\LogicalDisk(G:)\Disk Write Bytes/sec',
    '\LogicalDisk(G:)\Disk Transfers/sec',
    '\LogicalDisk(G:)\Current Disk Queue Length'
  )

  try {
    $counter = Get-Counter -Counter $paths -ErrorAction Stop
    $values = @{}
    foreach ($sample in @($counter.CounterSamples)) {
      $values[$sample.Path.ToLowerInvariant()] = [double]$sample.CookedValue
    }
    return [pscustomobject]@{
      DiskWriteBytesSec = $values.Keys | Where-Object { $_ -like '*logicaldisk(g:)*disk write bytes/sec' } | Select-Object -First 1 | ForEach-Object { $values[$_] }
      DiskTransfersSec = $values.Keys | Where-Object { $_ -like '*logicaldisk(g:)*disk transfers/sec' } | Select-Object -First 1 | ForEach-Object { $values[$_] }
      DiskQueueLength = $values.Keys | Where-Object { $_ -like '*logicaldisk(g:)*current disk queue length' } | Select-Object -First 1 | ForEach-Object { $values[$_] }
    }
  } catch {
    return [pscustomobject]@{
      DiskWriteBytesSec = $null
      DiskTransfersSec = $null
      DiskQueueLength = $null
    }
  }
}

$launcher = Get-Item -LiteralPath $LauncherPath
$launcherDir = $launcher.Directory.FullName
$programDataRoot = Join-Path $env:PROGRAMDATA 'Battle.net'
$localAppDataRoot = Join-Path $env:LOCALAPPDATA 'Battle.net'
$watchRoots = @(
  $launcherDir,
  $programDataRoot,
  $localAppDataRoot
)

$startedAt = Get-Date
$beforeProcesses = Get-BattleNetProcesses -LauncherDir $launcherDir

$launched = Start-Process -FilePath $LauncherPath -PassThru
Start-Sleep -Milliseconds 800

$samples = @()
$maxWriteDelta = 0
$maxDiskWriteBytesSec = 0
$allPids = @()
$baselineSnapshot = @{}

for ($i = 0; $i -lt $DurationSeconds; $i += [math]::Max(1, [int]([math]::Ceiling($SampleMs / 1000.0)))) {
  $procs = Get-BattleNetProcesses -LauncherDir $launcherDir
  foreach ($proc in @($procs)) {
    $allPids += [int]$proc.ProcessId
  }

  $pidList = @($allPids | Sort-Object -Unique)
  $ioSnapshot = Get-ProcessIoSnapshot -ProcessIds $pidList
  if ($baselineSnapshot.Count -eq 0) {
    $baselineSnapshot = $ioSnapshot
  }

  $writeBytes = 0
  $readBytes = 0
  foreach ($processId in @($ioSnapshot.Keys)) {
    $current = $ioSnapshot[$processId]
    $previous = $baselineSnapshot[$processId]
    if ($null -eq $previous) {
      $baselineSnapshot[$processId] = $current
      $previous = $current
    }
    $writeDelta = [math]::Max(0, $current.IOWriteBytes - $previous.IOWriteBytes)
    $readDelta = [math]::Max(0, $current.IOReadBytes - $previous.IOReadBytes)
    $writeBytes += $writeDelta
    $readBytes += $readDelta
    $baselineSnapshot[$processId] = $current
  }

  $diskCounters = Get-GDiskCounters
  $diskWriteBytesSec = $diskCounters.DiskWriteBytesSec
  $diskTransfersSec = $diskCounters.DiskTransfersSec
  $diskQueue = $diskCounters.DiskQueueLength

  if ($writeBytes -gt $maxWriteDelta) { $maxWriteDelta = $writeBytes }
  if ($diskWriteBytesSec -ne $null -and $diskWriteBytesSec -gt $maxDiskWriteBytesSec) { $maxDiskWriteBytesSec = $diskWriteBytesSec }

  $samples += [pscustomobject]@{
    Timestamp = Get-Date
    BattleNetProcessCount = $procs.Count
    ProcessWriteBytesDelta = $writeBytes
    ProcessReadBytesDelta = $readBytes
    GDiskWriteBytesSec = $diskWriteBytesSec
    GDiskTransfersSec = $diskTransfersSec
    GDiskQueueLength = $diskQueue
  }

  Start-Sleep -Milliseconds $SampleMs
}

$afterProcesses = Get-BattleNetProcesses -LauncherDir $launcherDir
$changedFiles = Get-TrackedFiles -Roots $watchRoots -Since $startedAt |
  Sort-Object LastWriteTime -Descending

$report = [pscustomobject]@{
  startedAt = $startedAt
  launcherPath = $LauncherPath
  launcherPid = $launched.Id
  durationSeconds = $DurationSeconds
  beforeProcesses = $beforeProcesses
  afterProcesses = $afterProcesses
  summary = [pscustomobject]@{
    sampleCount = $samples.Count
    maxProcessWriteBytesDeltaPerSample = $maxWriteDelta
    maxGDiskWriteBytesPerSec = $maxDiskWriteBytesSec
  }
  topSamples = $samples |
    Sort-Object ProcessWriteBytesDelta -Descending |
    Select-Object -First 10
  recentFileChanges = $changedFiles |
    Select-Object -First 80
}

$outputDir = Join-Path $PSScriptRoot '..\tmp'
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonPath = Join-Path $outputDir "battlenet-io-report-$timestamp.json"
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

Write-Output "REPORT_PATH=$jsonPath"
Write-Output ("MAX_PROCESS_WRITE_DELTA={0}" -f $maxWriteDelta)
$maxGWriteBpsValue = if ($null -ne $maxDiskWriteBytesSec) { [int64]$maxDiskWriteBytesSec } else { 0 }
Write-Output ("MAX_G_WRITE_BPS={0}" -f $maxGWriteBpsValue)
