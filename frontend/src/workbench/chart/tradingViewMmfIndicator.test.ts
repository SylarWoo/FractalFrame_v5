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
  it('keeps the MMF shell but does not calculate high markers', () => {
    const data = [100, 105, 111, 109, 107].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(
      data,
      { ...defaultMmfIndicatorSettings, dpoValue: 11, highMorganRatio: '0.118', showHigh: true },
    )

    expect(rows).toHaveLength(data.length)
    expect(rows.every((row) => !Number.isFinite(row.highMarker) && !Number.isFinite(row.highMarkerPrice))).toBe(true)
  })
})
