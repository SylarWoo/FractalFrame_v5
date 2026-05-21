import { describe, expect, it } from 'vitest'
import { calculateTradingViewTsiRows } from './tradingViewTsiIndicator'

const closeData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close,
  low: close,
  open: close,
  timestamp: index,
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
})
