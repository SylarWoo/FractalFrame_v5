import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateMaShiftRowsForKLineChart, calculateTradingViewMaShiftRows } from './tradingViewMaShiftIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

function row(close: number): KLineData {
  return {
    close,
    high: close,
    low: close,
    open: close,
    timestamp: close * 60_000,
    volume: 1,
  }
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

describe('calculateTradingViewMaShiftRows', () => {
  it('assigns the four MA Shift colors by oscillator quadrant and direction', () => {
    const values = [
      10, 10, 10,
      12, 14, 13, 12,
      10, 10, 10,
      6, 7,
      6, 4,
    ]
    const rows = calculateTradingViewMaShiftRows(values.map(row), {
      length: 3,
      shiftLength: 3,
      shiftMultiplier: 1,
      source: 'close',
      type: 'sma',
    })

    expect(rows.some((item) => item.maColor1 != null)).toBe(true)
    expect(rows.some((item) => item.maColor2 != null)).toBe(true)
    expect(rows.some((item) => item.maColor3 != null)).toBe(true)
    expect(rows.some((item) => item.maColor4 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor1 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor2 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor3 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor4 != null)).toBe(true)
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
    const settingsHash = createIndicatorSettingsHash({ indicator: 'MA', period: 'M5', settings: { length: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ maRows: [{ ma: 1 }, { ma: 2, maColorIndex: 1 }, { ma: 3, oscillator: 4 }] }),
      settingsHash,
      settingsHashKey: 'MA',
    })

    const rows = calculateMaShiftRowsForKLineChart(dataList, {
      length: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ ma: 2, maColorIndex: 1 })
    expect(rows[2]).toEqual({ ma: 3, oscillator: 4 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateMaShiftRowsForKLineChart(m5RowsFromCloses([1, 2, 3, 4]), {
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
