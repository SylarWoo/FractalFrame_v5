import { describe, expect, it } from 'vitest'
import { calculateMacdRowsForKLineChart, calculateTradingViewMacdRows } from './tradingViewMacdIndicator'
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

describe('calculateTradingViewMacdRows', () => {
  it('uses TradingView-style EMA seeded from the first source value', () => {
    const rows = calculateTradingViewMacdRows(closeData([1, 2, 3, 4, 5]), {
      fastLength: 2,
      signalLength: 2,
      slowLength: 3,
    })

    expect(rows.map((row) => row.macd)).toEqual(expect.arrayContaining([0]))
    expect(rows[1].macd).toBeCloseTo(0.1666666666666667, 12)
    expect(rows[2].macd).toBeCloseTo(0.30555555555555536, 12)
    expect(rows[3].macd).toBeCloseTo(0.39351851851851816, 12)
    expect(rows[4].macd).toBeCloseTo(0.4436728395061724, 12)
    expect(rows[4].signal).toBeCloseTo(0.4099794238683124, 12)
    expect(rows[4].histogram).toBeCloseTo(0.03369341563786, 12)
  })

  it('supports SMA oscillator and signal modes', () => {
    const rows = calculateTradingViewMacdRows(closeData([1, 2, 3, 4, 5, 6]), {
      fastLength: 2,
      oscillatorMaType: 'sma',
      signalLength: 2,
      signalMaType: 'sma',
      slowLength: 3,
    })

    expect(rows[0].macd).toBeUndefined()
    expect(rows[2].macd).toBe(0.5)
    expect(rows[3].signal).toBe(0.5)
    expect(rows[5].histogram).toBe(0)
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
    const settingsHash = createIndicatorSettingsHash({ indicator: 'MACD', period: 'M5', settings: { fastLength: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({
        macdRows: [
          { macd: 1 },
          { histogram: 3, macd: 2, signal: 4 },
          { histogram: 6, macd: 5, signal: 7 },
        ],
      }),
      settingsHash,
      settingsHashKey: 'MACD',
    })

    const rows = calculateMacdRowsForKLineChart(dataList, {
      fastLength: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ histogram: 3, macd: 2, signal: 4 })
    expect(rows[2]).toEqual({ histogram: 6, macd: 5, signal: 7 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateMacdRowsForKLineChart(m5CloseData([1, 2, 3, 4, 5]), {
      fastLength: 1,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-settings',
      slowLength: 1,
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}, {}])
  })
})
