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

const defaultMt5ApiBase = 'http://127.0.0.1:8765'

function resolveMt5ApiBase() {
  return String(
    import.meta.env.VITE_FRACTALFRAME_MARKET_DATA_HTTP_BASE || defaultMt5ApiBase,
  ).replace(/\/+$/, '')
}

export async function fetchMt5Symbols(
  options: {
    query?: string
    limit?: number
    refresh?: boolean
  } = {},
): Promise<Mt5SymbolsPayload> {
  const params = new URLSearchParams()
  const query = String(options.query ?? '').trim()
  if (query) params.set('query', query)
  params.set('limit', String(options.limit ?? 50000))
  if (options.refresh) params.set('refresh', '1')

  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/mt5/symbols?${params.toString()}`,
    {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    },
  )
  const payload = (await response.json()) as Mt5SymbolsPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function fetchStoreV5Check(symbol: string, count?: number): Promise<StoreV5CheckPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  if (typeof count === 'number' && Number.isFinite(count)) {
    params.set('count', String(count))
  }

  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/mt5/m1/check?${params.toString()}`,
    {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    },
  )
  const payload = (await response.json()) as StoreV5CheckPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function startMt5M1CheckJob(
  symbol: string,
  options: {
    chunk?: number
    maxCount?: number
    mode?: 'refresh' | 'incremental'
    sinceTime?: number | null
    baseFirstTime?: number | null
    baseLastTime?: number | null
    baseTrueM1RowsCount?: number | null
    baseMt5RowsCount?: number | null
    overlapBars?: number
  } = {},
): Promise<Mt5M1CheckJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('chunk', String(options.chunk ?? 200000))
  params.set('maxCount', String(options.maxCount ?? 10000000))
  if (options.mode) params.set('mode', options.mode)
  if (typeof options.sinceTime === 'number') params.set('sinceTime', String(options.sinceTime))
  if (typeof options.baseFirstTime === 'number') params.set('baseFirstTime', String(options.baseFirstTime))
  if (typeof options.baseLastTime === 'number') params.set('baseLastTime', String(options.baseLastTime))
  if (typeof options.baseTrueM1RowsCount === 'number') params.set('baseTrueM1RowsCount', String(options.baseTrueM1RowsCount))
  if (typeof options.baseMt5RowsCount === 'number') params.set('baseMt5RowsCount', String(options.baseMt5RowsCount))
  if (typeof options.overlapBars === 'number') params.set('overlapBars', String(options.overlapBars))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/mt5/m1/check/start?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as Mt5M1CheckJobPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function fetchMt5M1CheckJob(jobId: string): Promise<Mt5M1CheckJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/mt5/m1/check/progress?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as Mt5M1CheckJobPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function cancelMt5M1CheckJob(jobId: string): Promise<Mt5M1CheckJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/mt5/m1/check/cancel?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as Mt5M1CheckJobPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function fetchStoreV5Status(symbol: string): Promise<StoreV5CheckPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/status?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5CheckPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function deleteStoreV5Symbol(symbol: string): Promise<StoreV5DeletePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/delete?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5DeletePayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function deleteStoreV5AggregatedTimeframes(symbol: string, timeframes: string[]): Promise<StoreV5DeletePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('timeframes', timeframes.join(','))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/aggregated/delete?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5DeletePayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function pullStoreV5(symbol: string, mode = 'refresh', count?: number): Promise<StoreV5PullPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('mode', mode)
  if (typeof count === 'number' && Number.isFinite(count)) params.set('count', String(count))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/pull?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5PullPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function startStoreV5PullJob(symbol: string, mode = 'refresh', count?: number): Promise<StoreV5PullJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('mode', mode)
  if (typeof count === 'number' && Number.isFinite(count)) params.set('count', String(count))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/pull/start?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5PullJobPayload
  if (!response.ok) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function fetchStoreV5PullJob(jobId: string): Promise<StoreV5PullJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/pull/progress?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5PullJobPayload
  if (!response.ok) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export function createStoreV5PullEventSource(jobId: string): EventSource {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  return new EventSource(`${resolveMt5ApiBase()}/api/market-data/v1/store-v5/pull/events?${params.toString()}`)
}

export async function cancelStoreV5PullJob(jobId: string): Promise<StoreV5PullJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/pull/cancel?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5PullJobPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function aggregateStoreV5(symbol: string, timeframes?: string[]): Promise<StoreV5AggregatePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', '0')
  if (timeframes?.length) params.set('timeframes', timeframes.join(','))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/aggregate?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5AggregatePayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }
  return payload
}

export async function startStoreV5AggregateJob(symbol: string, timeframes?: string[]): Promise<StoreV5AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', '0')
  if (timeframes?.length) params.set('timeframes', timeframes.join(','))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/aggregate/start?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5AggregateJobPayload
  if (!response.ok) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function fetchStoreV5AggregateJob(jobId: string): Promise<StoreV5AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/aggregate/progress?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5AggregateJobPayload
  if (!response.ok) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export function createStoreV5AggregateEventSource(jobId: string): EventSource {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  return new EventSource(`${resolveMt5ApiBase()}/api/market-data/v1/store-v5/aggregate/events?${params.toString()}`)
}

export async function cleanStoreV5DirectM1(symbol: string): Promise<StoreV5CleanPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/direct-m1/clean?${params.toString()}`,
    { method: 'POST', headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5CleanPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || payload.status || `HTTP ${response.status}`)
  }
  return payload
}

export async function queryStoreV5Ohlcv(options: {
  symbol: string
  timeframe?: string
  mode?: string
  baseTimeframe?: string
  anchor?: string
  timeFrom?: number
  timeTo?: number
  limit?: number
}): Promise<StoreV5QueryPayload> {
  const params = new URLSearchParams()
  params.set('symbol', options.symbol)
  params.set('timeframe', options.timeframe ?? 'M1')
  params.set('mode', options.mode ?? 'direct')
  if (options.baseTimeframe) params.set('baseTimeframe', options.baseTimeframe)
  if (options.anchor) params.set('anchor', options.anchor)
  if (typeof options.timeFrom === 'number') params.set('timeFrom', String(options.timeFrom))
  if (typeof options.timeTo === 'number') params.set('timeTo', String(options.timeTo))
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))
  const response = await fetch(
    `${resolveMt5ApiBase()}/api/market-data/v1/store-v5/query?${params.toString()}`,
    { headers: { Accept: 'application/json' }, cache: 'no-store' },
  )
  const payload = (await response.json()) as StoreV5QueryPayload
  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }
  return payload
}
