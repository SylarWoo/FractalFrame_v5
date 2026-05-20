import { getMt5Json } from './mt5ApiClient'
import type { Mt5M1CheckJobPayload, StoreV5CheckPayload } from './types'

export async function fetchStoreV5Check(symbol: string, count?: number): Promise<StoreV5CheckPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  if (typeof count === 'number' && Number.isFinite(count)) {
    params.set('count', String(count))
  }

  return getMt5Json<StoreV5CheckPayload>(
    '/api/market-data/v1/mt5/m1/check',
    params,
    { requirePayloadOk: true },
  )
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

  return getMt5Json<Mt5M1CheckJobPayload>(
    '/api/market-data/v1/mt5/m1/check/start',
    params,
    { requirePayloadOk: true },
  )
}

export async function fetchMt5M1CheckJob(jobId: string): Promise<Mt5M1CheckJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<Mt5M1CheckJobPayload>(
    '/api/market-data/v1/mt5/m1/check/progress',
    params,
    { requirePayloadOk: true },
  )
}

export async function cancelMt5M1CheckJob(jobId: string): Promise<Mt5M1CheckJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<Mt5M1CheckJobPayload>(
    '/api/market-data/v1/mt5/m1/check/cancel',
    params,
    { requirePayloadOk: true },
  )
}
