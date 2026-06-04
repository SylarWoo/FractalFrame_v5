import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { futurePlaceholderFlag } from './chartFuturePlaceholders'
import { readIndicatorPageSnapshot } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

describe('pageIndicatorRuntime', () => {
  const rows = [
    { timestamp: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5 },
    { timestamp: 1_700_000_300_000, open: 2, high: 3, low: 1.5, close: 2.5 },
    { timestamp: 1_700_000_600_000, open: 0, high: 0, low: 0, close: 0, [futurePlaceholderFlag]: true },
  ] as KLineData[]

  it('creates a page-scoped context from real bars only', () => {
    const context = createPageIndicatorRuntimeContext({
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      rows,
      symbol: 'XAUUSDm',
    })

    expect(context.rowsCount).toBe(2)
    expect(context.barKeyFrom).toBe('XAUUSDm|M5|1700000000')
    expect(context.barKeyTo).toBe('XAUUSDm|M5|1700000300')
    expect(context.pageKey).toBe('XAUUSDm|M5|1|rt|1700000000|1700000300|2')
  })

  it('writes indicator rows aligned by the current page barKey', () => {
    const context = createPageIndicatorRuntimeContext({
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      rows,
      symbol: 'XAUUSDm',
    })

    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ stochRows: [{ k: 20, d: 30 }, { k: 40, d: 50 }] }),
      settingsHash: 'settings-a',
      settingsHashKey: 'Stoch',
    })

    const snapshot = readIndicatorPageSnapshot(context.pageKey)
    expect(snapshot?.settingsHashes?.Stoch).toBe('settings-a')
    expect(snapshot?.byBarKey['XAUUSDm|M5|1700000300']?.stoch).toEqual({ k: 40, d: 50 })
  })
})
