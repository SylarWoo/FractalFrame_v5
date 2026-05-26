import { describe, expect, it, vi } from 'vitest'
import type { KLineData } from 'klinecharts'
import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'

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
  it('marks the highest high between a start signal and fast-line confirmation', async () => {
    vi.resetModules()
    vi.doMock('./tradingViewDpoIndicator', () => ({
      calculateTradingViewDpoRows: () => [
        { dpo: 10 },
        { dpo: 12 },
        { dpo: 8 },
        { dpo: 12 },
        { dpo: 14 },
        { dpo: 13 },
        { dpo: 7 },
      ],
    }))
    vi.doMock('./tradingViewStochIndicator', () => ({
      calculateTradingViewStochRows: () => [
        { k: 88, d: 84 },
        { k: 86, d: 82 },
        { k: 82, d: 83 },
        { k: 81, d: 82 },
        { k: 78, d: 79 },
        { k: 76, d: 77 },
        { k: 74, d: 75 },
      ],
    }))
    vi.doMock('./morganRangeModel', () => ({
      calculateMorganRangeSegments: () => [],
      getMorganRangeLevel: () => null,
    }))

    const { calculateTradingViewMmfRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 102, 108, 104, 112, 109, 106].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(
      data,
      { ...defaultMmfIndicatorSettings, dpoValue: 11, highMorganRatio: '0.118', showHigh: true },
    )
    const markerIndexes = rows
      .map((row, index) => Number.isFinite(row.highMarker) ? index : -1)
      .filter((index) => index >= 0)

    expect(markerIndexes).toEqual([4])
    expect(rows[4]?.highMarker).toBe(112.5)
    vi.doUnmock('./tradingViewDpoIndicator')
    vi.doUnmock('./tradingViewStochIndicator')
    vi.doUnmock('./morganRangeModel')
  })

  it('does not start from values already above a threshold without an upward break', async () => {
    vi.resetModules()
    vi.doMock('./tradingViewDpoIndicator', () => ({
      calculateTradingViewDpoRows: () => [
        { dpo: 12 },
        { dpo: 13 },
        { dpo: 14 },
        { dpo: 9 },
      ],
    }))
    vi.doMock('./tradingViewStochIndicator', () => ({
      calculateTradingViewStochRows: () => [
        { k: 86, d: 82 },
        { k: 81, d: 83 },
        { k: 76, d: 77 },
        { k: 74, d: 75 },
      ],
    }))
    vi.doMock('./morganRangeModel', () => ({
      calculateMorganRangeSegments: () => [],
      getMorganRangeLevel: () => null,
    }))

    const { calculateTradingViewMmfRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 105, 107, 103].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(
      data,
      { ...defaultMmfIndicatorSettings, dpoValue: 11, highMorganRatio: '0.118', showHigh: true },
    )

    expect(rows.some((row) => Number.isFinite(row.highMarker))).toBe(false)
    vi.doUnmock('./tradingViewDpoIndicator')
    vi.doUnmock('./tradingViewStochIndicator')
    vi.doUnmock('./morganRangeModel')
  })
})
