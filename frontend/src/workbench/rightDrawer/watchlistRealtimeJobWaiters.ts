import {
  createStoreV5AggregateEventSource,
  createStoreV5PullEventSource,
} from '../../services/mt5/mt5SymbolsApi'
import type { StoreV5AggregateJobPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'

type WatchlistRealtimeJobWaiterOptions = {
  isActive: () => boolean
  pushLog: (message: string) => void
  setStatus: (status: string) => void
}

function parseJobPayload<T>(event: Event) {
  return JSON.parse((event as MessageEvent).data) as T
}

export function waitForWatchlistPullJob(jobId: string, symbol: string, options: WatchlistRealtimeJobWaiterOptions) {
  return new Promise<void>((resolve, reject) => {
    const source = createStoreV5PullEventSource(jobId)
    const cleanup = () => source.close()
    const fail = (message: string) => {
      cleanup()
      reject(new Error(message))
    }

    source.addEventListener('progress', (event) => {
      try {
        const payload = parseJobPayload<StoreV5PullJobPayload>(event)
        if (!options.isActive()) {
          cleanup()
          resolve()
          return
        }
        const line = `${symbol} ${payload.progressLabel || payload.status || 'Pulling M1'}`
        options.setStatus(line)
        options.pushLog(line)
      } catch {
        options.setStatus(`${symbol} Pulling M1`)
      }
    })
    source.addEventListener('done', () => {
      options.pushLog(`${symbol} M1 gap fill completed`)
      cleanup()
      resolve()
    })
    source.addEventListener('cancelled', () => fail(`${symbol} pull cancelled`))
    source.addEventListener('error', (event) => {
      try {
        const payload = parseJobPayload<{ error?: string; status?: string }>(event)
        fail(payload.error || payload.status || `${symbol} pull failed`)
      } catch {
        fail(`${symbol} pull failed`)
      }
    })
    source.onerror = () => fail(`${symbol} pull disconnected`)
  })
}

export function waitForWatchlistAggregateJob(jobId: string, symbol: string, options: WatchlistRealtimeJobWaiterOptions) {
  return new Promise<void>((resolve, reject) => {
    const source = createStoreV5AggregateEventSource(jobId)
    const cleanup = () => source.close()
    const fail = (message: string) => {
      cleanup()
      reject(new Error(message))
    }

    source.addEventListener('progress', (event) => {
      try {
        const payload = parseJobPayload<StoreV5AggregateJobPayload>(event)
        if (!options.isActive()) {
          cleanup()
          resolve()
          return
        }
        const line = `${symbol} ${payload.progressLabel || payload.status || 'Aggregating'}`
        options.setStatus(line)
        options.pushLog(line)
      } catch {
        options.setStatus(`${symbol} Aggregating`)
      }
    })
    source.addEventListener('done', () => {
      options.pushLog(`${symbol} aggregation completed`)
      cleanup()
      resolve()
    })
    source.addEventListener('cancelled', () => fail(`${symbol} aggregate cancelled`))
    source.addEventListener('error', (event) => {
      try {
        const payload = parseJobPayload<{ error?: string; status?: string }>(event)
        fail(payload.error || payload.status || `${symbol} aggregate failed`)
      } catch {
        fail(`${symbol} aggregate failed`)
      }
    })
    source.onerror = () => fail(`${symbol} aggregate disconnected`)
  })
}
