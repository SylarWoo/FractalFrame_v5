import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateRsiRowsForKLineChart, calculateTradingViewRsiRows } from './tradingViewRsiIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

function rowsFromCloses(closes: number[]): KLineData[] {
  return closes.map((close, index) => ({
    close,
    high: close,
    low: close,
    open: close,
    timestamp: index,
    volume: 1,
  }))
}

function m5RowsFromCloses(closes: number[]): KLineData[] {
  return closes.map((close, index) => ({
    close,
    high: close,
    low: close,
    open: close,
    timestamp: index * 300_000,
    volume: 1,
  }))
}

describe('calculateTradingViewRsiRows', () => {
  it('uses Wilder RMA smoothing after the initial SMA seed', () => {
    const rows = calculateTradingViewRsiRows(rowsFromCloses([1, 2, 3, 2, 4, 3, 5]), { length: 3, smoothingLength: 3 })

    expect(rows[0].rsi).toBeUndefined()
    expect(rows[1].rsi).toBeUndefined()
    expect(rows[2].rsi).toBeUndefined()
    expect(rows[3].rsi).toBeCloseTo(66.6666667, 6)
    expect(rows[4].rsi).toBeCloseTo(83.3333333, 6)
    expect(rows[5].rsi).toBeCloseTo(60.6060606, 6)
    expect(rows[6].rsi).toBeCloseTo(78.3333333, 6)
    expect(rows[5].rsiMa).toBeCloseTo(70.2020202, 6)
  })

  it('reads page runtime cache instead of recalculating when runtimeOnly is enabled', () => {
    const dataList = m5RowsFromCloses([1, 2, 3])
    const context = createPageIndicatorRuntimeContext({
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      rows: dataList,
      symbol: 'XAUUSDm',
    })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'RSI', period: 'M5', settings: { length: 3 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ rsiRows: [{ rsi: 10 }, { rsi: 20, rsiMa: 30 }, { rsi: 40, rsiMa: 50 }] }),
      settingsHash,
      settingsHashKey: 'RSI',
    })

    const rows = calculateRsiRowsForKLineChart(dataList, {
      length: 3,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ rsi: 20, rsiMa: 30 })
    expect(rows[2]).toEqual({ rsi: 40, rsiMa: 50 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateRsiRowsForKLineChart(m5RowsFromCloses([1, 2, 3, 4, 5]), {
      length: 2,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-settings',
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}, {}])
  })
})
