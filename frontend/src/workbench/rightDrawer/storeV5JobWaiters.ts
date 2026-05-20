import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  createStoreV5AggregateEventSource,
  createStoreV5PullEventSource,
  fetchStoreV5AggregateJob,
  fetchStoreV5PullJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { StoreV5AggregateJobPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import { delay } from '../mt5DataCenter/storeV5StatusFormat'

type PullWaiterOptions = {
  activePullJobRef: MutableRefObject<string>
  pullEventSourceRef: MutableRefObject<EventSource | null>
  setPullProgress: Dispatch<SetStateAction<StoreV5PullJobPayload | null>>
}

type AggregateWaiterOptions = {
  activeAggregateJobRef: MutableRefObject<string>
  aggregateEventSourceRef: MutableRefObject<EventSource | null>
  setAggregateProgress: Dispatch<SetStateAction<StoreV5AggregateJobPayload | null>>
}

export function waitStoreV5PullJobBySse(jobId: string, {
  activePullJobRef,
  pullEventSourceRef,
  setPullProgress,
}: PullWaiterOptions) {
  return new Promise<StoreV5PullJobPayload>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      pullEventSourceRef.current?.close()
      pullEventSourceRef.current = null
      fn()
    }
    const applyPayload = (event: MessageEvent) => {
      if (activePullJobRef.current !== jobId) return null
      const payload = JSON.parse(event.data || '{}') as StoreV5PullJobPayload
      setPullProgress(payload)
      return payload
    }
    try {
      const source = createStoreV5PullEventSource(jobId)
      pullEventSourceRef.current = source
      source.addEventListener('progress', (event) => {
        try { applyPayload(event as MessageEvent) } catch { /* ignore malformed progress */ }
      })
      source.addEventListener('done', (event) => {
        try { finish(() => resolve(applyPayload(event as MessageEvent) as StoreV5PullJobPayload)) } catch (err) { finish(() => reject(err)) }
      })
      source.addEventListener('cancelled', (event) => {
        try { applyPayload(event as MessageEvent) } catch { /* ignore malformed cancelled payload */ }
        finish(() => reject(new Error('store_v5_pull_cancelled')))
      })
      source.addEventListener('error', (event) => {
        const messageEvent = event as MessageEvent
        if (messageEvent.data) {
          try {
            const payload = applyPayload(messageEvent)
            finish(() => reject(new Error(payload?.error || payload?.status || 'store_v5_pull_failed')))
            return
          } catch { /* fall through to generic error */ }
        }
        if (!settled && activePullJobRef.current === jobId) finish(() => reject(new Error('store_v5_pull_sse_disconnected')))
      })
    } catch (err) {
      finish(() => reject(err))
    }
  })
}

export async function waitStoreV5PullJobByPolling(jobId: string, {
  activePullJobRef,
  setPullProgress,
}: PullWaiterOptions) {
  while (activePullJobRef.current === jobId) {
    await delay(600)
    const current = await fetchStoreV5PullJob(jobId)
    setPullProgress(current)
    if (current.phase === 'completed') return current
    if (current.phase === 'failed' || current.phase === 'cancelled') throw new Error(current.error || current.status || current.phase)
  }
  throw new Error('store_v5_pull_cancelled')
}

export function waitStoreV5AggregateJobBySse(jobId: string, {
  activeAggregateJobRef,
  aggregateEventSourceRef,
  setAggregateProgress,
}: AggregateWaiterOptions) {
  return new Promise<StoreV5AggregateJobPayload>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      aggregateEventSourceRef.current?.close()
      aggregateEventSourceRef.current = null
      fn()
    }
    const applyPayload = (event: MessageEvent) => {
      if (activeAggregateJobRef.current !== jobId) return null
      const payload = JSON.parse(event.data || '{}') as StoreV5AggregateJobPayload
      setAggregateProgress(payload)
      return payload
    }
    try {
      const source = createStoreV5AggregateEventSource(jobId)
      aggregateEventSourceRef.current = source
      source.addEventListener('progress', (event) => {
        try { applyPayload(event as MessageEvent) } catch { /* ignore malformed progress */ }
      })
      source.addEventListener('done', (event) => {
        try { finish(() => resolve(applyPayload(event as MessageEvent) as StoreV5AggregateJobPayload)) } catch (err) { finish(() => reject(err)) }
      })
      source.addEventListener('cancelled', (event) => {
        try { applyPayload(event as MessageEvent) } catch { /* ignore malformed cancelled payload */ }
        finish(() => reject(new Error('store_v5_aggregate_cancelled')))
      })
      source.addEventListener('error', (event) => {
        const messageEvent = event as MessageEvent
        if (messageEvent.data) {
          try {
            const payload = applyPayload(messageEvent)
            finish(() => reject(new Error(payload?.error || payload?.status || 'store_v5_aggregate_failed')))
            return
          } catch { /* fall through to generic error */ }
        }
        if (!settled && activeAggregateJobRef.current === jobId) finish(() => reject(new Error('store_v5_aggregate_sse_disconnected')))
      })
    } catch (err) {
      finish(() => reject(err))
    }
  })
}

export async function waitStoreV5AggregateJobByPolling(jobId: string, {
  activeAggregateJobRef,
  setAggregateProgress,
}: AggregateWaiterOptions) {
  while (activeAggregateJobRef.current === jobId) {
    await delay(600)
    const current = await fetchStoreV5AggregateJob(jobId)
    setAggregateProgress(current)
    if (current.phase === 'completed') return current
    if (current.phase === 'failed' || current.phase === 'cancelled') throw new Error(current.error || current.status || current.phase)
  }
  throw new Error('store_v5_aggregate_cancelled')
}
