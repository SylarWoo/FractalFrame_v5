import { describe, expect, it, vi } from 'vitest'
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

  it('freezes the first valid stoch reversal threshold until confirmation', async () => {
    vi.resetModules()
    vi.doMock('./tradingViewDpoIndicator', () => ({
      calculateTradingViewDpoRows: (dataList: KLineData[]) => dataList.map(() => ({ dpo: 12 })),
    }))
    vi.doMock('./tradingViewStochIndicator', () => ({
      calculateTradingViewStochRows: () => [
        { k: 82, d: 81 },
        { k: 79, d: 80 },
        { k: 76, d: 77 },
        { k: 72, d: 74 },
        { k: 71, d: 72 },
        { k: 66, d: 68 },
        { k: 74, d: 73 },
        { k: 69, d: 71 },
        { k: 76, d: 76 },
        { k: 74, d: 74 },
      ],
    }))
    vi.doMock('./morganRangeModel', () => ({
      calculateMorganRangeSegments: () => [],
      getMorganRangeLevel: () => null,
    }))
    const { calculateTradingViewMmfRows: calculateRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 105, 111, 109, 107, 106, 108, 107, 106, 104].map((close, index) => createRow(index, close))
    const rows = calculateRows(
      data,
      { ...defaultMmfIndicatorSettings, dpoValue: 11, highMorganRatio: '0.118', showHigh: true },
    )
    const markerIndexes = rows
      .map((row, index) => Number.isFinite(row.highMarker) ? index : -1)
      .filter((index) => index >= 0)

    expect(markerIndexes).toEqual([2])
    expect(rows[2]?.highMarker).toBe(111.5)
    vi.doUnmock('./tradingViewDpoIndicator')
    vi.doUnmock('./tradingViewStochIndicator')
    vi.doUnmock('./morganRangeModel')
  })
})
