export type StoreV6DirectM1 = {
  datasetKey?: string
  mt5RowsCount?: number | null
  trueM1RowsCount?: number | null
  rowsCount?: number | null
  firstTime?: number | null
  lastTime?: number | null
  firstTimeText?: string | null
  lastTimeText?: string | null
  firstAnchorTime?: number | null
  firstHourM1CheckOk?: boolean | null
  firstHourTrueRows?: number | null
  gapCount?: number | null
  m1IntegrityStatus?: string | null
  lastImportAt?: string | null
  status?: string | null
  rootPath?: string | null
  validationOk?: boolean | null
  validationError?: string | null
}

export type StoreV6RawDirectM1 = {
  datasetKey?: string
  mt5RowsCount?: number | null
  rawRowsCount?: number | null
  rowsCount?: number | null
  firstTime?: number | null
  lastTime?: number | null
  firstTimeText?: string | null
  lastTimeText?: string | null
  cleanStatus?: string | null
  lastImportAt?: string | null
  status?: string | null
  rootPath?: string | null
}

export type StoreV6AggregatedCell = {
  timeframe?: string
  rowsCount?: number | null
  lastTime?: number | null
  lastTimeText?: string | null
  sourceLastTime?: number | null
  sourceTrueM1RowsCount?: number | null
  anchor?: string | null
  dirty?: boolean | null
  lastAggregateAt?: string | null
}

export type StoreV6CheckPayload = {
  ok: boolean
  status: string
  provider?: string
  storeVersion?: string
  symbol: string
  rawDirectM1?: StoreV6RawDirectM1 | null
  directM1: StoreV6DirectM1 | null
  liveLag?: {
    error?: string
    lagM1Bars?: number | null
    lagSeconds?: number | null
    mt5LatestM1Time?: number | null
    mt5LatestM1TimeText?: string | null
    ok?: boolean
    status?: string
    storeLastM1Time?: number | null
    storeLastM1TimeText?: string | null
    symbol?: string
  } | null
  aggregated: StoreV6AggregatedCell[]
  publishedAt?: string
  error?: string
}

export type StoreV6PullPayload = {
  ok: boolean
  status?: string
  error?: string
  symbol: string
  importMode?: string
  rowsWritten?: number
  mt5RowsCount?: number
  trueM1RowsCount?: number
  noNewClosedM1?: boolean
  nextOpenTime?: number
  latestClosedTime?: number
}

export type StoreV6AggregatePayload = {
  ok: boolean
  error?: string
  symbol: string
  results?: Record<string, {
    ok?: boolean
    error?: string
    rowsCount?: number
    rowsWritten?: number
    dirty?: boolean
  }>
}

export type StoreV6CleanPayload = {
  ok: boolean
  status?: string
  error?: string
  symbol: string
  rowsWritten?: number
  mt5RowsCount?: number
  trueM1RowsCount?: number
  cleanStatus?: string
}

export type StoreV6DeletePayload = {
  ok: boolean
  status: string
  error?: string
  symbol: string
  deletedDatasets?: string[]
  deletedDirs?: string[]
}

export type StoreV6AuditPayload = {
  ok: boolean
  status: string
  symbol: string
  storeRoot?: string
  checkedDatasets: number
  issueDatasets: number
  repairedDatasets: number
  datasets: Array<{
    datasetKey: string
    mode?: string
    timeframe?: string
    issues: string[]
    manifest?: Record<string, unknown>
    parquet?: Record<string, unknown>
    repaired?: boolean
  }>
  publishedAt?: string
}

export type StoreV6M1GapRepairPayload = {
  ok: boolean
  status: string
  error?: string
  symbol: string
  lookbackMinutes?: number
  gapsDetected?: number
  gaps?: Array<{
    previousTime: number
    nextTime: number
    deltaSeconds: number
    missingBarsEstimate: number
  }>
  rowsWritten?: number
  rawRowsWritten?: number
  firstRepairTime?: number | null
  lastRepairTime?: number | null
  publishedAt?: string
}

export type StoreV6QueryRow = {
  barKey?: string
  close: number
  closeTime?: number
  globalIndex?: number | null
  low: number
  open: number
  openTime?: number
  sessionId?: string | null
  sessionRuleId?: string | null
  sessionRuleVersion?: number | null
  sessionState?: string | null
  time: number
  timestamp?: number
  tradingDay?: string | null
  high: number
  isTradingTime?: boolean | null
  volume?: number
}

export type StoreV6QueryPayload = {
  ok: boolean
  error?: string
  symbol: string
  timeframe: string
  mode: string
  rowsCount: number
  rows: StoreV6QueryRow[]
  metadata?: {
    indexFromResult?: number | null
    indexToResult?: number | null
    timeFromResult?: number | null
    timeToResult?: number | null
    datasetKey?: string
  }
}

export type StoreV6IndexTimesPayload = {
  ok: boolean
  error?: string
  symbol: string
  timeframe: string
  mode?: string
  rowsCount: number
  rows: Array<{
    globalIndex: number
    openTime?: number
    time: number
  }>
  metadata?: {
    datasetKey?: string
    requestedIndicesCount?: number
  }
}

export type StoreV6DailyMaintenanceRecord = {
  aggregateJobId?: string | null
  date: string
  error?: string
  failureReason?: string
  finishedAt?: string | null
  pagePlanVersion?: string | null
  pullJobId?: string | null
  runId?: string
  startedAt?: string | null
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | string
  symbol: string
  trigger?: string
  updatedAt?: string
}

export type StoreV6DailyMaintenanceEvent = {
  createdAt?: string
  date?: string
  error?: string
  eventId?: string
  pagePlanVersion?: string
  reason?: string
  runId?: string
  status?: string
  step?: string
  symbol?: string
  trigger?: string
  [key: string]: unknown
}

export type StoreV6DailyMaintenanceStatusPayload = {
  ok: boolean
  status: string
  today: string
  maintenanceHour?: number
  timezone?: string
  records: StoreV6DailyMaintenanceRecord[]
  updatedAt?: string | null
  error?: string
}

export type StoreV6DailyMaintenanceEventsPayload = {
  ok: boolean
  status: string
  count: number
  events: StoreV6DailyMaintenanceEvent[]
  error?: string
}

export type StoreV6DailyMaintenanceStartPayload = {
  ok: boolean
  status: string
  symbol: string
  trigger?: string
  reason?: string
  error?: string
}
