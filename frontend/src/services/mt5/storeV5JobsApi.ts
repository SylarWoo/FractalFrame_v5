import { createMt5EventSource, getMt5Json } from './mt5ApiClient'
import type { StoreV5AggregateJobPayload, StoreV5PullJobPayload } from './types'

export async function startStoreV5PullJob(symbol: string, mode = 'refresh', count?: number): Promise<StoreV5PullJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('mode', mode)
  if (typeof count === 'number' && Number.isFinite(count)) params.set('count', String(count))

  return getMt5Json<StoreV5PullJobPayload>(
    '/api/market-data/v1/store-v5/pull/start',
    params,
  )
}

export async function fetchStoreV5PullJob(jobId: string): Promise<StoreV5PullJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV5PullJobPayload>(
    '/api/market-data/v1/store-v5/pull/progress',
    params,
  )
}

export function createStoreV5PullEventSource(jobId: string): EventSource {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  return createMt5EventSource('/api/market-data/v1/store-v5/pull/events', params)
}

export async function cancelStoreV5PullJob(jobId: string): Promise<StoreV5PullJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV5PullJobPayload>(
    '/api/market-data/v1/store-v5/pull/cancel',
    params,
    { requirePayloadOk: true },
  )
}

export async function startStoreV5AggregateJob(symbol: string, timeframes?: string[]): Promise<StoreV5AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('symbol', symbol)
  params.set('rebuild', '0')
  if (timeframes?.length) params.set('timeframes', timeframes.join(','))

  return getMt5Json<StoreV5AggregateJobPayload>(
    '/api/market-data/v1/store-v5/aggregate/start',
    params,
  )
}

export async function fetchStoreV5AggregateJob(jobId: string): Promise<StoreV5AggregateJobPayload> {
  const params = new URLSearchParams()
  params.set('jobId', jobId)

  return getMt5Json<StoreV5AggregateJobPayload>(
    '/api/market-data/v1/store-v5/aggregate/progress',
    params,
  )
}

export function createStoreV5AggregateEventSource(jobId: string): EventSource {
  const params = new URLSearchParams()
  params.set('jobId', jobId)
  return createMt5EventSource('/api/market-data/v1/store-v5/aggregate/events', params)
}
