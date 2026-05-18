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

export type StoreV5AggregatedCell = {
  timeframe?: string
  rowsCount?: number | null
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

export async function aggregateStoreV5(symbol: string): Promise<StoreV5AggregatePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', '1')
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
