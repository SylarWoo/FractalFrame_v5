import { describe, expect, it } from 'vitest'
import { calculateTradingViewTsiRows, calculateTsiRowsForKLineChart } from './tradingViewTsiIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

const closeData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close,
  low: close,
  open: close,
  timestamp: index,
  volume: 1,
}))

const m5CloseData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close,
  low: close,
  open: close,
  timestamp: index * 300_000,
  volume: 1,
}))

describe('calculateTradingViewTsiRows', () => {
  it('calculates TradingView-style double EMA momentum TSI', () => {
    const rows = calculateTradingViewTsiRows(closeData([1, 2, 4, 3, 6]), {
      longLength: 2,
      shortLength: 2,
      signalLength: 2,
    })

    expect(rows[0].tsi).toBeUndefined()
    expect(rows[1].tsi).toBe(100)
    expect(rows[2].tsi).toBe(100)
    expect(rows[3].tsi).toBeCloseTo(25.00000000000001, 12)
    expect(rows[4].tsi).toBeCloseTo(70.24793388429751, 12)
    expect(rows[4].signal).toBeCloseTo(63.49862258953168, 12)
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
    const settingsHash = createIndicatorSettingsHash({ indicator: 'TSI', period: 'M5', settings: { longLength: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ tsiRows: [{ tsi: 10 }, { signal: 30, tsi: 20 }, { signal: 50, tsi: 40 }] }),
      settingsHash,
      settingsHashKey: 'TSI',
    })

    const rows = calculateTsiRowsForKLineChart(dataList, {
      longLength: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ signal: 30, tsi: 20 })
    expect(rows[2]).toEqual({ signal: 50, tsi: 40 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateTsiRowsForKLineChart(m5CloseData([1, 2, 3, 4, 5]), {
      longLength: 1,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-settings',
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}, {}])
  })
})
