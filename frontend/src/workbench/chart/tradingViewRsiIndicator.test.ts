import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateTradingViewRsiRows } from './tradingViewRsiIndicator'

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
})
