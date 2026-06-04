import { getMt5Json, postMt5Json } from './mt5ApiClient'
import type {
  StoreV6AggregatePayload,
  StoreV6CheckPayload,
  StoreV6CleanPayload,
  StoreV6DeletePayload,
  StoreV6M1GapRepairPayload,
  StoreV6PullPayload,
  StoreV6QueryPayload,
  StoreV6IndexTimesPayload,
  StoreV6AuditPayload,
  StoreV6DailyMaintenanceEventsPayload,
  StoreV6DailyMaintenanceStartPayload,
  StoreV6DailyMaintenanceStatusPayload,
} from './types'
import type { Mt5RealtimeTick } from './mt5Types'

export async function fetchStoreV6Status(symbol: string): Promise<StoreV6CheckPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return getMt5Json<StoreV6CheckPayload>(
    '/api/market-data/v1/store-v6/status',
    params,
    { requirePayloadOk: true },
  )
}

export async function fetchStoreV6DailyMaintenanceStatus(symbol?: string): Promise<StoreV6DailyMaintenanceStatusPayload> {
  const params = new URLSearchParams()
  if (symbol) params.set('symbol', symbol)

  return getMt5Json<StoreV6DailyMaintenanceStatusPayload>(
    '/api/market-data/v1/store-v6/daily-maintenance/status',
    params,
    { requirePayloadOk: true },
  )
}

export async function fetchStoreV6DailyMaintenanceEvents(symbol?: string, limit = 200): Promise<StoreV6DailyMaintenanceEventsPayload> {
  const params = new URLSearchParams()
  if (symbol) params.set('symbol', symbol)
  params.set('limit', String(limit))

  return getMt5Json<StoreV6DailyMaintenanceEventsPayload>(
    '/api/market-data/v1/store-v6/daily-maintenance/events',
    params,
    { requirePayloadOk: true },
  )
}

export async function startStoreV6DailyMaintenance(symbol: string, trigger = 'manual'): Promise<StoreV6DailyMaintenanceStartPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('trigger', trigger)

  return getMt5Json<StoreV6DailyMaintenanceStartPayload>(
    '/api/market-data/v1/store-v6/daily-maintenance/start',
    params,
    { requirePayloadOk: true },
  )
}

export async function fetchStoreV6Symbols(): Promise<{
  ok: boolean
  status: string
  count: number
  totalCount?: number
  symbols: Array<{
    symbol: string
    name?: string
    description?: string
    path?: string
    category?: string
    source?: string
    market?: string
    visible?: boolean
  }>
  error?: string
}> {
  return getMt5Json(
    '/api/market-data/v1/store-v6/symbols',
    undefined,
    { requirePayloadOk: true },
  )
}

export async function deleteStoreV6Symbol(symbol: string): Promise<StoreV6DeletePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return getMt5Json<StoreV6DeletePayload>(
    '/api/market-data/v1/store-v6/delete',
    params,
    { requirePayloadOk: true },
  )
}

export async function repairStoreV6M1Gaps(
  symbol: string,
  options: { lookbackMinutes?: number; maxGapMinutes?: number } = {},
): Promise<StoreV6M1GapRepairPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('lookbackMinutes', String(options.lookbackMinutes ?? 360))
  params.set('maxGapMinutes', String(options.maxGapMinutes ?? 240))

  return getMt5Json<StoreV6M1GapRepairPayload>(
    '/api/market-data/v1/store-v6/m1/repair-gaps',
    params,
    { requirePayloadOk: true },
  )
}

export async function deleteStoreV6AggregatedTimeframes(symbol: string, timeframes: string[]): Promise<StoreV6DeletePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('timeframes', timeframes.join(','))

  return getMt5Json<StoreV6DeletePayload>(
    '/api/market-data/v1/store-v6/aggregated/delete',
    params,
    { requirePayloadOk: true },
  )
}

export async function pullStoreV6(symbol: string, mode = 'refresh', count?: number): Promise<StoreV6PullPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('mode', mode)
  if (typeof count === 'number' && Number.isFinite(count)) params.set('count', String(count))

  return getMt5Json<StoreV6PullPayload>(
    '/api/market-data/v1/store-v6/pull',
    params,
    { requirePayloadOk: true },
  )
}

export async function aggregateStoreV6(symbol: string, timeframes?: string[]): Promise<StoreV6AggregatePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', '0')
  if (timeframes?.length) params.set('timeframes', timeframes.join(','))

  return getMt5Json<StoreV6AggregatePayload>(
    '/api/market-data/v1/store-v6/aggregate',
    params,
    { requirePayloadOk: true },
  )
}

export async function auditStoreV6(symbol: string, options: { repair?: boolean } = {}): Promise<StoreV6AuditPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  if (options.repair) params.set('repair', '1')

  return getMt5Json<StoreV6AuditPayload>(
    '/api/market-data/v1/store-v6/audit',
    params,
    { requirePayloadOk: true },
  )
}

export async function cleanStoreV6DirectM1(symbol: string): Promise<StoreV6CleanPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return postMt5Json<StoreV6CleanPayload>(
    '/api/market-data/v1/store-v6/direct-m1/clean',
    params,
    { requirePayloadOk: true },
  )
}

export async function queryStoreV6Ohlcv(options: {
  symbol: string
  timeframe?: string
  mode?: string
  baseTimeframe?: string
  anchor?: string
  indexFrom?: number
  indexTo?: number
  timeFrom?: number
  timeTo?: number
  limit?: number
}): Promise<StoreV6QueryPayload> {
  const params = new URLSearchParams()
  const timeframe = options.timeframe ?? 'M1'
  params.set('symbol', options.symbol)
  params.set('timeframe', timeframe)
  params.set('mode', options.mode === 'direct' ? 'clean' : options.mode ?? (timeframe === 'M1' ? 'clean' : 'aggregated'))
  if (options.baseTimeframe) params.set('baseTimeframe', options.baseTimeframe)
  if (options.anchor) params.set('anchor', options.anchor)
  if (typeof options.indexFrom === 'number') params.set('indexFrom', String(options.indexFrom))
  if (typeof options.indexTo === 'number') params.set('indexTo', String(options.indexTo))
  if (typeof options.timeFrom === 'number') params.set('timeFrom', String(options.timeFrom))
  if (typeof options.timeTo === 'number') params.set('timeTo', String(options.timeTo))
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))

  return getMt5Json<StoreV6QueryPayload>(
    '/api/market-data/v1/store-v6/query',
    params,
    { requirePayloadOk: true },
  )
}

export async function queryStoreV6IndexTimes(options: {
  symbol: string
  timeframe?: string
  mode?: string
  indices: number[]
}): Promise<StoreV6IndexTimesPayload> {
  const params = new URLSearchParams()
  const timeframe = options.timeframe ?? 'M1'
  params.set('symbol', options.symbol)
  params.set('timeframe', timeframe)
  params.set('mode', options.mode === 'direct' ? 'clean' : options.mode ?? (timeframe === 'M1' ? 'clean' : 'aggregated'))
  params.set('indices', [...new Set(options.indices.filter((value) => Number.isFinite(value)).map((value) => Math.round(value)))].join(','))

  return getMt5Json<StoreV6IndexTimesPayload>(
    '/api/market-data/v1/store-v6/index-times',
    params,
    { requirePayloadOk: true },
  )
}

export async function queryMt5Rates(options: {
  symbol: string
  timeframe?: string
  timeFrom?: number
  timeTo?: number
  limit?: number
}): Promise<StoreV6QueryPayload> {
  const params = new URLSearchParams()
  params.set('symbol', options.symbol)
  params.set('timeframe', options.timeframe ?? 'M1')
  if (typeof options.timeFrom === 'number') params.set('timeFrom', String(options.timeFrom))
  if (typeof options.timeTo === 'number') params.set('timeTo', String(options.timeTo))
  if (typeof options.limit === 'number') params.set('limit', String(options.limit))

  return getMt5Json<StoreV6QueryPayload>(
    '/api/market-data/v1/mt5/rates',
    params,
    { requirePayloadOk: true },
  )
}

export async function queryMt5Tick(symbol: string): Promise<{ ok: boolean; status?: string; tick?: Mt5RealtimeTick | null }> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return getMt5Json<{ ok: boolean; status?: string; error?: string; tick?: Mt5RealtimeTick | null }>(
    '/api/market-data/v1/mt5/tick',
    params,
    { requirePayloadOk: true },
  )
}
