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

type JobPayload = {
  phase?: string
  status?: string
  error?: string
}

type SseWaiterOptions<TPayload extends JobPayload> = {
  activeJobRef: MutableRefObject<string>
  eventSourceRef: MutableRefObject<EventSource | null>
  setProgress: Dispatch<SetStateAction<TPayload | null>>
  createEventSource: (jobId: string) => EventSource
  cancelledError: string
  failedError: string
  disconnectedError: string
}

type PollWaiterOptions<TPayload extends JobPayload> = {
  activeJobRef: MutableRefObject<string>
  setProgress: Dispatch<SetStateAction<TPayload | null>>
  fetchJob: (jobId: string) => Promise<TPayload>
  cancelledError: string
}

function waitJobBySse<TPayload extends JobPayload>(jobId: string, {
  activeJobRef,
  eventSourceRef,
  setProgress,
  createEventSource,
  cancelledError,
  failedError,
  disconnectedError,
}: SseWaiterOptions<TPayload>) {
  return new Promise<TPayload>((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      fn()
    }
    const applyPayload = (event: MessageEvent) => {
      if (activeJobRef.current !== jobId) return null
      const payload = JSON.parse(event.data || '{}') as TPayload
      setProgress(payload)
      return payload
    }
    try {
      const source = createEventSource(jobId)
      eventSourceRef.current = source
      source.addEventListener('progress', (event) => {
        try { applyPayload(event as MessageEvent) } catch { /* ignore malformed progress */ }
      })
      source.addEventListener('done', (event) => {
        try { finish(() => resolve(applyPayload(event as MessageEvent) as TPayload)) } catch (err) { finish(() => reject(err)) }
      })
      source.addEventListener('cancelled', (event) => {
        try { applyPayload(event as MessageEvent) } catch { /* ignore malformed cancelled payload */ }
        finish(() => reject(new Error(cancelledError)))
      })
      source.addEventListener('error', (event) => {
        const messageEvent = event as MessageEvent
        if (messageEvent.data) {
          try {
            const payload = applyPayload(messageEvent)
            finish(() => reject(new Error(payload?.error || payload?.status || failedError)))
            return
          } catch { /* fall through to generic error */ }
        }
        if (!settled && activeJobRef.current === jobId) finish(() => reject(new Error(disconnectedError)))
      })
    } catch (err) {
      finish(() => reject(err))
    }
  })
}

async function waitJobByPolling<TPayload extends JobPayload>(jobId: string, {
  activeJobRef,
  setProgress,
  fetchJob,
  cancelledError,
}: PollWaiterOptions<TPayload>) {
  while (activeJobRef.current === jobId) {
    await delay(600)
    const current = await fetchJob(jobId)
    setProgress(current)
    if (current.phase === 'completed') return current
    if (current.phase === 'failed' || current.phase === 'cancelled') throw new Error(current.error || current.status || current.phase)
  }
  throw new Error(cancelledError)
}

export function waitStoreV5PullJobBySse(jobId: string, {
  activePullJobRef,
  pullEventSourceRef,
  setPullProgress,
}: PullWaiterOptions) {
  return waitJobBySse<StoreV5PullJobPayload>(jobId, {
    activeJobRef: activePullJobRef,
    eventSourceRef: pullEventSourceRef,
    setProgress: setPullProgress,
    createEventSource: createStoreV5PullEventSource,
    cancelledError: 'store_v5_pull_cancelled',
    failedError: 'store_v5_pull_failed',
    disconnectedError: 'store_v5_pull_sse_disconnected',
  })
}

export async function waitStoreV5PullJobByPolling(jobId: string, {
  activePullJobRef,
  setPullProgress,
}: PullWaiterOptions) {
  return waitJobByPolling<StoreV5PullJobPayload>(jobId, {
    activeJobRef: activePullJobRef,
    setProgress: setPullProgress,
    fetchJob: fetchStoreV5PullJob,
    cancelledError: 'store_v5_pull_cancelled',
  })
}

export function waitStoreV5AggregateJobBySse(jobId: string, {
  activeAggregateJobRef,
  aggregateEventSourceRef,
  setAggregateProgress,
}: AggregateWaiterOptions) {
  return waitJobBySse<StoreV5AggregateJobPayload>(jobId, {
    activeJobRef: activeAggregateJobRef,
    eventSourceRef: aggregateEventSourceRef,
    setProgress: setAggregateProgress,
    createEventSource: createStoreV5AggregateEventSource,
    cancelledError: 'store_v5_aggregate_cancelled',
    failedError: 'store_v5_aggregate_failed',
    disconnectedError: 'store_v5_aggregate_sse_disconnected',
  })
}

export async function waitStoreV5AggregateJobByPolling(jobId: string, {
  activeAggregateJobRef,
  setAggregateProgress,
}: AggregateWaiterOptions) {
  return waitJobByPolling<StoreV5AggregateJobPayload>(jobId, {
    activeJobRef: activeAggregateJobRef,
    setProgress: setAggregateProgress,
    fetchJob: fetchStoreV5AggregateJob,
    cancelledError: 'store_v5_aggregate_cancelled',
  })
}
