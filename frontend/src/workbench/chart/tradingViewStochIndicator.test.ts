import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateStochRowsForKLineChart, calculateTradingViewStochRows } from './tradingViewStochIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

function row(high: number, low: number, close: number): KLineData {
  return {
    timestamp: close * 60_000,
    open: close,
    high,
    low,
    close,
    volume: 1,
  }
}

describe('calculateTradingViewStochRows', () => {
  it('calculates TradingView-style smoothed %K and %D', () => {
    const rows = calculateTradingViewStochRows(
      [
        row(10, 0, 5),
        row(11, 1, 10),
        row(12, 2, 11),
        row(13, 3, 12),
        row(14, 4, 13),
      ],
      { dSmoothing: 2, kSmoothing: 2, length: 3 },
    )

    expect(rows[0].k).toBeUndefined()
    expect(rows[1].k).toBeUndefined()
    expect(rows[2].k).toBeUndefined()
    expect(rows[3].k).toBeCloseTo(91.6666666667)
    expect(rows[4].k).toBeCloseTo(91.6666666667)
    expect(rows[4].d).toBeCloseTo(91.6666666667)
  })

  it('reads page runtime cache instead of recalculating when runtimeOnly is enabled', () => {
    const dataList = [
      row(10, 0, 5),
      row(11, 1, 10),
      row(12, 2, 11),
    ]
    const context = createPageIndicatorRuntimeContext({
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      rows: dataList,
      symbol: 'XAUUSDm',
    })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'Stoch', period: 'M5', settings: { length: 3 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ stochRows: [{ k: 10 }, { k: 20, d: 30 }, { k: 40, d: 50 }] }),
      settingsHash,
      settingsHashKey: 'Stoch',
    })

    const rows = calculateStochRowsForKLineChart(dataList, {
      length: 3,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ k: 20, d: 30 })
    expect(rows[2]).toEqual({ k: 40, d: 50 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const dataList = [
      row(10, 0, 5),
      row(11, 1, 10),
      row(12, 2, 11),
      row(13, 3, 12),
    ]

    const rows = calculateStochRowsForKLineChart(dataList, {
      dSmoothing: 1,
      kSmoothing: 1,
      length: 1,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-settings',
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}])
  })
})
