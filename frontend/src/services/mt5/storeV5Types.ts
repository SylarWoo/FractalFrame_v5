export type StoreV5DirectM1 = {
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

export type StoreV5RawDirectM1 = {
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

export type StoreV5AggregatedCell = {
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

export type StoreV5CheckPayload = {
  ok: boolean
  status: string
  provider?: string
  storeVersion?: string
  symbol: string
  rawDirectM1?: StoreV5RawDirectM1 | null
  directM1: StoreV5DirectM1 | null
  aggregated: StoreV5AggregatedCell[]
  publishedAt?: string
  error?: string
}

export type StoreV5PullPayload = {
  ok: boolean
  status?: string
  error?: string
  symbol: string
  importMode?: string
  rowsWritten?: number
  mt5RowsCount?: number
  trueM1RowsCount?: number
}

export type StoreV5AggregatePayload = {
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

export type StoreV5CleanPayload = {
  ok: boolean
  status?: string
  error?: string
  symbol: string
  rowsWritten?: number
  mt5RowsCount?: number
  trueM1RowsCount?: number
  cleanStatus?: string
}

export type StoreV5DeletePayload = {
  ok: boolean
  status: string
  error?: string
  symbol: string
  deletedDatasets?: string[]
  deletedDirs?: string[]
}

export type StoreV5M1GapRepairPayload = {
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

export type StoreV5QueryRow = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type StoreV5QueryPayload = {
  ok: boolean
  error?: string
  symbol: string
  timeframe: string
  mode: string
  rowsCount: number
  rows: StoreV5QueryRow[]
  metadata?: {
    timeFromResult?: number | null
    timeToResult?: number | null
    datasetKey?: string
  }
}
