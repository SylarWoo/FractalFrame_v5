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
