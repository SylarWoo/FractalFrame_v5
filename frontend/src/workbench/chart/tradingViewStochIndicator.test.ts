import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateTradingViewStochRows } from './tradingViewStochIndicator'

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
})
