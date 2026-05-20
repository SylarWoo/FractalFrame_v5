import { getMt5Json, postMt5Json } from './mt5ApiClient'
import type {
  StoreV5AggregatePayload,
  StoreV5CheckPayload,
  StoreV5CleanPayload,
  StoreV5DeletePayload,
  StoreV5M1GapRepairPayload,
  StoreV5PullPayload,
  StoreV5QueryPayload,
} from './types'

export async function fetchStoreV5Status(symbol: string): Promise<StoreV5CheckPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return getMt5Json<StoreV5CheckPayload>(
    '/api/market-data/v1/store-v5/status',
    params,
    { requirePayloadOk: true },
  )
}

export async function deleteStoreV5Symbol(symbol: string): Promise<StoreV5DeletePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return getMt5Json<StoreV5DeletePayload>(
    '/api/market-data/v1/store-v5/delete',
    params,
    { requirePayloadOk: true },
  )
}

export async function repairStoreV5M1Gaps(
  symbol: string,
  options: { lookbackMinutes?: number; maxGapMinutes?: number } = {},
): Promise<StoreV5M1GapRepairPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('lookbackMinutes', String(options.lookbackMinutes ?? 360))
  params.set('maxGapMinutes', String(options.maxGapMinutes ?? 240))

  return getMt5Json<StoreV5M1GapRepairPayload>(
    '/api/market-data/v1/store-v5/m1/repair-gaps',
    params,
    { requirePayloadOk: true },
  )
}

export async function deleteStoreV5AggregatedTimeframes(symbol: string, timeframes: string[]): Promise<StoreV5DeletePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('timeframes', timeframes.join(','))

  return getMt5Json<StoreV5DeletePayload>(
    '/api/market-data/v1/store-v5/aggregated/delete',
    params,
    { requirePayloadOk: true },
  )
}

export async function pullStoreV5(symbol: string, mode = 'refresh', count?: number): Promise<StoreV5PullPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('mode', mode)
  if (typeof count === 'number' && Number.isFinite(count)) params.set('count', String(count))

  return getMt5Json<StoreV5PullPayload>(
    '/api/market-data/v1/store-v5/pull',
    params,
    { requirePayloadOk: true },
  )
}

export async function aggregateStoreV5(symbol: string, timeframes?: string[]): Promise<StoreV5AggregatePayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', '0')
  if (timeframes?.length) params.set('timeframes', timeframes.join(','))

  return getMt5Json<StoreV5AggregatePayload>(
    '/api/market-data/v1/store-v5/aggregate',
    params,
    { requirePayloadOk: true },
  )
}

export async function cleanStoreV5DirectM1(symbol: string): Promise<StoreV5CleanPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return postMt5Json<StoreV5CleanPayload>(
    '/api/market-data/v1/store-v5/direct-m1/clean',
    params,
    { requirePayloadOk: true },
  )
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

  return getMt5Json<StoreV5QueryPayload>(
    '/api/market-data/v1/store-v5/query',
    params,
    { requirePayloadOk: true },
  )
}
