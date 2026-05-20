import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  StoreV5AggregateJobPayload,
  StoreV5CheckPayload,
  StoreV5PullJobPayload,
} from '../../services/mt5/mt5SymbolsApi'
import { resolveLocalM1Rows } from '../mt5DataCenter/storeV5StatusFormat'
import {
  waitStoreV5AggregateJobByPolling,
  waitStoreV5AggregateJobBySse,
  waitStoreV5PullJobByPolling,
  waitStoreV5PullJobBySse,
} from './storeV5JobWaiters'

export const storeV5M1RepairOptions = {
  lookbackMinutes: 720,
  maxGapMinutes: 720,
}

type PullJobRefs = {
  activePullJobRef: MutableRefObject<string>
  pullEventSourceRef: MutableRefObject<EventSource | null>
  setPullProgress: Dispatch<SetStateAction<StoreV5PullJobPayload | null>>
}

type AggregateJobRefs = {
  activeAggregateJobRef: MutableRefObject<string>
  aggregateEventSourceRef: MutableRefObject<EventSource | null>
  setAggregateProgress: Dispatch<SetStateAction<StoreV5AggregateJobPayload | null>>
}

export function rowsForStorePeriod(payload: StoreV5CheckPayload, period: string) {
  return period === 'M1'
    ? resolveLocalM1Rows(payload)
    : payload.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
}

export function resolveStoreV5PullMode(currentStore: StoreV5CheckPayload | null) {
  if (
    currentStore?.rawDirectM1?.lastTime != null
    || currentStore?.rawDirectM1?.rowsCount != null
    || currentStore?.directM1?.lastTime != null
    || currentStore?.directM1?.rowsCount != null
  ) {
    return 'incremental'
  }
  return 'refresh'
}

export function createPendingAggregateProgress(symbol: string, periods: string[]): StoreV5AggregateJobPayload {
  return {
    ok: true,
    jobId: '',
    symbol,
    phase: 'running',
    status: 'store_v5_aggregate_running',
    periods,
    currentPeriod: periods[0],
    completed: 0,
    total: periods.length,
  }
}

export function createCompletedAggregateProgress(
  jobId: string,
  symbol: string,
  periods: string[],
): StoreV5AggregateJobPayload {
  return {
    ok: true,
    jobId,
    symbol,
    phase: 'completed',
    status: 'store_v5_aggregate_completed',
    periods,
    completed: periods.length,
    total: periods.length,
  }
}

export function clearPullJobRefs({ activePullJobRef, pullEventSourceRef }: Pick<PullJobRefs, 'activePullJobRef' | 'pullEventSourceRef'>) {
  activePullJobRef.current = ''
  pullEventSourceRef.current?.close()
  pullEventSourceRef.current = null
}

export function clearAggregateJobRefs({
  activeAggregateJobRef,
  aggregateEventSourceRef,
}: Pick<AggregateJobRefs, 'activeAggregateJobRef' | 'aggregateEventSourceRef'>) {
  activeAggregateJobRef.current = ''
  aggregateEventSourceRef.current?.close()
  aggregateEventSourceRef.current = null
}

export async function waitStoreV5PullJobWithFallback(jobId: string, refs: PullJobRefs) {
  try {
    return await waitStoreV5PullJobBySse(jobId, refs)
  } catch (err) {
    if (refs.activePullJobRef.current !== jobId) throw err
    return waitStoreV5PullJobByPolling(jobId, refs)
  }
}

export async function waitStoreV5AggregateJobWithFallback(jobId: string, refs: AggregateJobRefs) {
  try {
    return await waitStoreV5AggregateJobBySse(jobId, refs)
  } catch (err) {
    if (refs.activeAggregateJobRef.current !== jobId) throw err
    return waitStoreV5AggregateJobByPolling(jobId, refs)
  }
}
