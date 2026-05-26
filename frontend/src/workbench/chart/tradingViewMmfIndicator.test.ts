import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateTradingViewMmfRows } from './tradingViewMmfIndicator'

function createRow(index: number, close: number): KLineData {
  return {
    close,
    high: close + 0.5,
    low: close - 0.5,
    open: close,
    timestamp: 1_700_000_000_000 + index * 5 * 60 * 1000,
    volume: 1,
  }
}

describe('tradingViewMmfIndicator', () => {
  it('marks the highest candle between candidate start and stoch reversal confirmation', () => {
    const closes = [
      ...Array.from({ length: 35 }, (_, index) => 100 + index * 2),
      168,
      166,
      162,
      158,
      154,
      150,
      146,
      142,
      138,
      134,
      130,
      126,
      122,
      118,
      114,
      110,
    ]
    const data = closes.map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(
      data,
      { ...defaultMmfIndicatorSettings, dpoValue: 0, highMorganRatio: '0.118', showHigh: true },
    )
    const markerIndex = rows.findIndex((row) => Number.isFinite(row.highMarker))

    expect(markerIndex).toBeGreaterThanOrEqual(0)
    expect(rows[markerIndex]?.highMarker).toBe(Math.max(...closes.map((close) => close + 0.5)))
  })

  it('does not confirm a high from a bearish stoch cross below 65', () => {
    const closes = [
      ...Array.from({ length: 25 }, (_, index) => 100 + index * 2),
      150,
      148,
      144,
      140,
      136,
      132,
      128,
      124,
      120,
      116,
      112,
      108,
      104,
      100,
      96,
      92,
      88,
      84,
      80,
      76,
      72,
      68,
      64,
      60,
    ]
    const rows = calculateTradingViewMmfRows(
      closes.map((close, index) => createRow(index, close)),
      { ...defaultMmfIndicatorSettings, dpoValue: 0, highMorganRatio: '0.118', showHigh: true },
    )

    expect(rows.some((row) => Number.isFinite(row.highMarker))).toBe(false)
  })
})
