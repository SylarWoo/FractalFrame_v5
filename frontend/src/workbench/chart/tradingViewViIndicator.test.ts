import { describe, expect, it } from 'vitest'
import { calculateTradingViewViRows, calculateViRowsForKLineChart } from './tradingViewViIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

const m5CloseData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close + 1,
  low: close - 1,
  open: close,
  timestamp: index * 300_000,
  volume: 1,
}))

describe('calculateTradingViewViRows', () => {
  it('calculates Vortex VI+ and VI- from movement sums divided by true range sums', () => {
    const rows = calculateTradingViewViRows([
      { close: 9, high: 10, low: 8, open: 9, timestamp: 0, volume: 1 },
      { close: 11, high: 12, low: 9, open: 9, timestamp: 1, volume: 1 },
      { close: 10, high: 13, low: 10, open: 11, timestamp: 2, volume: 1 },
      { close: 13, high: 14, low: 11, open: 10, timestamp: 3, volume: 1 },
    ], { length: 2 })

    expect(rows[0].plus).toBeUndefined()
    expect(rows[1].plus).toBeUndefined()
    expect(rows[2].plus).toBeCloseTo(1.3333333333333333, 12)
    expect(rows[2].minus).toBeCloseTo(0.5, 12)
    expect(rows[3].plus).toBeCloseTo(1.1428571428571428, 12)
    expect(rows[3].minus).toBeCloseTo(0.5714285714285714, 12)
  })

  it('reads page runtime cache instead of recalculating when runtimeOnly is enabled', () => {
    const dataList = m5CloseData([1, 2, 3])
    const context = createPageIndicatorRuntimeContext({
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      rows: dataList,
      symbol: 'XAUUSDm',
    })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'VI', period: 'M5', settings: { length: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ viRows: [{ plus: 1 }, { minus: 3, plus: 2 }, { minus: 5, plus: 4 }] }),
      settingsHash,
      settingsHashKey: 'VI',
    })

    const rows = calculateViRowsForKLineChart(dataList, {
      length: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ minus: 3, plus: 2 })
    expect(rows[2]).toEqual({ minus: 5, plus: 4 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateViRowsForKLineChart(m5CloseData([1, 2, 3, 4]), {
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
