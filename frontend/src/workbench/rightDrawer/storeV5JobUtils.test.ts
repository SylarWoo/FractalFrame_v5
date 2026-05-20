import { describe, expect, it } from 'vitest'
import type { StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import {
  createCompletedAggregateProgress,
  createPendingAggregateProgress,
  resolveStoreV5PullMode,
  rowsForStorePeriod,
} from './storeV5JobUtils'

function status(overrides: Partial<StoreV5CheckPayload> = {}): StoreV5CheckPayload {
  return {
    ok: true,
    status: 'ok',
    symbol: 'XAUUSDm',
    directM1: null,
    rawDirectM1: null,
    aggregated: [],
    ...overrides,
  }
}

describe('storeV5JobUtils', () => {
  it('resolves rows for direct M1 and aggregated periods', () => {
    const payload = status({
      directM1: { rowsCount: 100 },
      aggregated: [{ timeframe: 'H4', rowsCount: 25 }],
    })

    expect(rowsForStorePeriod(payload, 'M1')).toBe(100)
    expect(rowsForStorePeriod(payload, 'H4')).toBe(25)
    expect(rowsForStorePeriod(payload, 'D1')).toBeUndefined()
  })

  it('selects incremental pull mode only when local direct rows exist', () => {
    expect(resolveStoreV5PullMode(null)).toBe('refresh')
    expect(resolveStoreV5PullMode(status())).toBe('refresh')
    expect(resolveStoreV5PullMode(status({ rawDirectM1: { rowsCount: 10 } }))).toBe('incremental')
    expect(resolveStoreV5PullMode(status({ directM1: { lastTime: 1779235200 } }))).toBe('incremental')
  })

  it('creates aggregate progress payloads consistently', () => {
    expect(createPendingAggregateProgress('XAUUSDm', ['H1', 'H4'])).toMatchObject({
      jobId: '',
      phase: 'running',
      currentPeriod: 'H1',
      completed: 0,
      total: 2,
    })
    expect(createCompletedAggregateProgress('job-1', 'XAUUSDm', ['H1', 'H4'])).toMatchObject({
      jobId: 'job-1',
      phase: 'completed',
      completed: 2,
      total: 2,
    })
  })
})
