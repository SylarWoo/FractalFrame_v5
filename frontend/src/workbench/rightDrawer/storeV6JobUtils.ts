import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  StoreV6AggregateJobPayload,
  StoreV6CheckPayload,
  StoreV6PullJobPayload,
} from '../../services/mt5/mt5SymbolsApi'
import { resolveLocalM1Rows } from '../mt5DataCenter/storeV6StatusFormat'
import {
  waitStoreV6AggregateJobByPolling,
  waitStoreV6AggregateJobBySse,
  waitStoreV6PullJobByPolling,
  waitStoreV6PullJobBySse,
} from './storeV6JobWaiters'

export const storeV6M1RepairOptions = {
  lookbackMinutes: 2880,
  maxGapMinutes: 720,
}

type PullJobRefs = {
  activePullJobRef: MutableRefObject<string>
  pullEventSourceRef: MutableRefObject<EventSource | null>
  setPullProgress: Dispatch<SetStateAction<StoreV6PullJobPayload | null>>
}

type AggregateJobRefs = {
  activeAggregateJobRef: MutableRefObject<string>
  aggregateEventSourceRef: MutableRefObject<EventSource | null>
  setAggregateProgress: Dispatch<SetStateAction<StoreV6AggregateJobPayload | null>>
}

export function rowsForStorePeriod(payload: StoreV6CheckPayload, period: string) {
  return period === 'M1'
    ? resolveLocalM1Rows(payload)
    : payload.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
}

export function resolveStoreV6PullMode(currentStore: StoreV6CheckPayload | null) {
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

export function createPendingAggregateProgress(symbol: string, periods: string[]): StoreV6AggregateJobPayload {
  return {
    ok: true,
    jobId: '',
    symbol,
    phase: 'running',
    status: 'store_v6_aggregate_running',
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
): StoreV6AggregateJobPayload {
  return {
    ok: true,
    jobId,
    symbol,
    phase: 'completed',
    status: 'store_v6_aggregate_completed',
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

export async function waitStoreV6PullJobWithFallback(jobId: string, refs: PullJobRefs) {
  try {
    return await waitStoreV6PullJobBySse(jobId, refs)
  } catch (err) {
    if (refs.activePullJobRef.current !== jobId) throw err
    return waitStoreV6PullJobByPolling(jobId, refs)
  }
}

export async function waitStoreV6AggregateJobWithFallback(jobId: string, refs: AggregateJobRefs) {
  try {
    return await waitStoreV6AggregateJobBySse(jobId, refs)
  } catch (err) {
    if (refs.activeAggregateJobRef.current !== jobId) throw err
    return waitStoreV6AggregateJobByPolling(jobId, refs)
  }
}
