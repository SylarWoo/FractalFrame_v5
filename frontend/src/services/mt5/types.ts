export type Mt5SymbolRow = {
  symbol: string
  name?: string
  description?: string
  path?: string
  category?: string
  source?: string
  market?: string
  visible?: boolean
  digits?: number | null
  spread?: number | null
  spreadFloat?: boolean | null
  currencyBase?: string
  currencyProfit?: string
  currencyMargin?: string
  tradeMode?: number | null
  tradeCalcMode?: number | null
  tradeContractSize?: number | null
  volumeMin?: number | null
  volumeMax?: number | null
  volumeStep?: number | null
  tradeTickSize?: number | null
  tradeTickValue?: number | null
  tradeStopsLevel?: number | null
}

export type Mt5SymbolsPayload = {
  ok: boolean
  status: string
  count: number
  totalCount?: number
  symbols: Mt5SymbolRow[]
  error?: string
  scanReport?: {
    added?: number
    updated?: number
  }
  cache?: {
    ready?: boolean
    updatedAt?: string
    lastScanReport?: {
      added?: number
      updated?: number
    }
  }
}

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

export type Mt5M1CheckJobPayload = {
  ok: boolean
  jobId: string
  symbol: string
  mode?: 'refresh' | 'incremental' | string
  phase: 'queued' | 'fetching' | 'validating' | 'completed' | 'failed' | 'cancelled' | string
  status: string
  error?: string
  chunkSize?: number
  maxCount?: number | null
  chunksCompleted?: number
  currentBatchIndex?: number
  currentBatchRequested?: number
  currentBatchFetched?: number
  mt5RowsCount?: number
  progressPercent?: number | null
  firstTimeText?: string | null
  lastTimeText?: string | null
  result?: StoreV5CheckPayload
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

export type StoreV5PullJobPayload = {
  ok: boolean
  jobId: string
  symbol: string
  mode: 'refresh' | 'incremental' | string
  phase: string
  status: string
  error?: string
  currentAction?: string
  progressPercent?: number | null
  progressLabel?: string
  detailMessage?: string
  rowsFetched?: number
  rowsWritten?: number
  rawRowsCount?: number
  duplicateRows?: number
  trueM1RowsCount?: number
  discardedBeforeTrueM1RowsCount?: number
  gapCount?: number
  validationPreviewStatus?: string
  chunksCompleted?: number
  fetchChunkSize?: number
  maxCount?: number | null
  currentBatchIndex?: number
  currentBatchRequested?: number
  currentBatchFetched?: number
  probedRowsCount?: number
  writeBatchStart?: number
  writeBatchRows?: number
  writeBatchWritten?: number
  pendingWriteRows?: number
  writeBatchSize?: number
  cleanupStatus?: string
  cleanupDeletedRows?: number
  cleanupKeptRows?: number
  firstTimeText?: string | null
  lastTimeText?: string | null
  result?: StoreV5PullPayload
  createdAt?: string
  updatedAt?: string
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

export type StoreV5AggregateJobPayload = {
  ok: boolean
  jobId: string
  symbol: string
  phase: string
  status: string
  error?: string
  targets?: string[]
  currentTarget?: string | null
  currentIndex?: number
  totalTargets?: number
  progressPercent?: number | null
  progressLabel?: string
  results?: StoreV5AggregatePayload['results']
  result?: StoreV5AggregatePayload
  periods: string[]
  currentPeriod?: string
  completed: number
  total: number
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

export type Mt5RealtimeTick = {
  symbol: string
  bid?: number | null
  ask?: number | null
  last?: number | null
  volume?: number | null
  time?: number | null
  timeMsc?: number | null
  dayOpen?: number | null
  change?: number | null
  changePercent?: number | null
  publishedAt?: string
}

export type Mt5DiagnosticsPayload = {
  ok: boolean
  status: string
  error?: string
  symbol?: string | null
  symbolSelectOk?: boolean
  terminal?: Record<string, unknown> | null
  account?: Record<string, unknown> | null
  publishedAt?: string
}

export type RuntimeObservabilityPayload = {
  ok: boolean
  status: string
  startedAt: string
  publishedAt: string
  paths: Record<string, string>
  jobs: Record<string, { count: number; failed: number }>
  activeOperations?: Array<{ symbol: string; operation: string }>
}
