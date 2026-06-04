import { describe, expect, it } from 'vitest'
import type { StoreV6CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import {
  createCompletedAggregateProgress,
  createPendingAggregateProgress,
  resolveStoreV6PullMode,
  rowsForStorePeriod,
} from './storeV6JobUtils'
import { resolveStoreV6AggregateTargets, storeTableAggregatePeriods } from './rightDrawerStoreTables'

function status(overrides: Partial<StoreV6CheckPayload> = {}): StoreV6CheckPayload {
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

describe('storeV6JobUtils', () => {
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
    expect(resolveStoreV6PullMode(null)).toBe('refresh')
    expect(resolveStoreV6PullMode(status())).toBe('refresh')
    expect(resolveStoreV6PullMode(status({ rawDirectM1: { rowsCount: 10 } }))).toBe('incremental')
    expect(resolveStoreV6PullMode(status({ directM1: { lastTime: 1779235200 } }))).toBe('incremental')
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

  it('targets only missing, dirty, or stale aggregate periods', () => {
    const cleanLastTime = 2000
    expect(resolveStoreV6AggregateTargets(status({
      directM1: { lastTime: cleanLastTime, rowsCount: 100 },
      aggregated: [],
    }))).toEqual(storeTableAggregatePeriods)

    expect(resolveStoreV6AggregateTargets(status({
      directM1: { lastTime: cleanLastTime, rowsCount: 100 },
      aggregated: storeTableAggregatePeriods.map((period) => ({
        timeframe: period,
        rowsCount: 10,
        lastTime: cleanLastTime,
        sourceLastTime: cleanLastTime,
        dirty: false,
      })),
    }))).toEqual([])

    expect(resolveStoreV6AggregateTargets(status({
      directM1: { lastTime: cleanLastTime, rowsCount: 100 },
      aggregated: [
        { timeframe: 'M5', rowsCount: 10, lastTime: cleanLastTime, sourceLastTime: cleanLastTime, dirty: false },
        { timeframe: 'H1', rowsCount: 10, sourceLastTime: 1000, dirty: false },
        { timeframe: 'H4', rowsCount: 10, sourceLastTime: cleanLastTime, dirty: true },
      ],
    }))).toEqual(['M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'])
  })

  it('targets aggregate periods whose source time is current but last bar is behind', () => {
    const cleanLastTime = 1780403460

    expect(resolveStoreV6AggregateTargets(status({
      directM1: { lastTime: cleanLastTime, rowsCount: 100 },
      aggregated: storeTableAggregatePeriods.map((period) => ({
        timeframe: period,
        rowsCount: 10,
        sourceLastTime: cleanLastTime,
        lastTime: period === 'M5' ? 1780401300 : cleanLastTime,
        dirty: false,
      })),
    }))).toContain('M5')
  })
})
