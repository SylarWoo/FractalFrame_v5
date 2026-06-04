import { createMt5EventSource, getMt5Json } from './mt5ApiClient'
import type { StoreV6AggregateJobPayload, StoreV6PullJobPayload } from './types'

export async function startStoreV6PullJob(symbol: string, mode = 'refresh', count?: number): Promise<StoreV6PullJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('mode', mode)
  if (typeof count === 'number' && Number.isFinite(count)) params.set('count', String(count))

  return getMt5Json<StoreV6PullJobPayload>(
    '/api/market-data/v1/store-v6/pull/start',
    params,
  )
}

export async function fetchStoreV6PullJob(jobId: string): Promise<StoreV6PullJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV6PullJobPayload>(
    '/api/market-data/v1/store-v6/pull/progress',
    params,
  )
}

export function createStoreV6PullEventSource(jobId: string): EventSource {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  return createMt5EventSource('/api/market-data/v1/store-v6/pull/events', params)
}

export async function cancelStoreV6PullJob(jobId: string): Promise<StoreV6PullJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV6PullJobPayload>(
    '/api/market-data/v1/store-v6/pull/cancel',
    params,
    { requirePayloadOk: true },
  )
}

export async function startStoreV6AggregateJob(
  symbol: string,
  timeframes?: string[],
  options: { rebuild?: boolean } = {},
): Promise<StoreV6AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', options.rebuild ? '1' : '0')
  if (timeframes?.length) params.set('timeframes', timeframes.join(','))

  return getMt5Json<StoreV6AggregateJobPayload>(
    '/api/market-data/v1/store-v6/aggregate/start',
    params,
  )
}

export async function fetchStoreV6AggregateJob(jobId: string): Promise<StoreV6AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV6AggregateJobPayload>(
    '/api/market-data/v1/store-v6/aggregate/progress',
    params,
  )
}

export function createStoreV6AggregateEventSource(jobId: string): EventSource {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  return createMt5EventSource('/api/market-data/v1/store-v6/aggregate/events', params)
}

export async function cancelStoreV6AggregateJob(jobId: string): Promise<StoreV6AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV6AggregateJobPayload>(
    '/api/market-data/v1/store-v6/aggregate/cancel',
    params,
    { requirePayloadOk: true },
  )
}

export async function cancelStoreV6AggregateJobsForSymbol(symbol: string): Promise<{ ok: boolean; status: string; symbol: string; cancelledCount: number; jobs: StoreV6AggregateJobPayload[] }> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)

  return getMt5Json(
    '/api/market-data/v1/store-v6/aggregate/cancel',
    params,
    { requirePayloadOk: true },
  )
}
