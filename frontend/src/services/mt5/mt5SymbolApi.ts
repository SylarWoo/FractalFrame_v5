import { getMt5Json } from './mt5ApiClient'
import type { Mt5SymbolsPayload } from './types'

export async function fetchMt5Symbols(
  options: {
    includeSessions?: boolean
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
  if (options.includeSessions) params.set('sessions', '1')

  return getMt5Json<Mt5SymbolsPayload>(
    '/api/market-data/v1/mt5/symbols',
    params,
    { requirePayloadOk: true },
  )
}
