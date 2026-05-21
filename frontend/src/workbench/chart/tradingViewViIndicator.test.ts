import { describe, expect, it } from 'vitest'
import { calculateTradingViewViRows } from './tradingViewViIndicator'

describe('calculateTradingViewViRows', () => {
  it('calculates Vortex VI+ and VI- from movement sums divided by true range sums', () => {
    const rows = calculateTradingViewViRows([
      { close: 9, high: 10, low: 8, open: 9, timestamp: 0, volume: 1 },
      { close: 11, high: 12, low: 9, open: 9, timestamp: 1, volume: 1 },
      { close: 10, high: 13, low: 10, open: 11, timestamp: 2, volume: 1 },
      { close: 13, high: 14, low: 11, open: 10, timestamp: 3, volume: 1 },
    ], { length: 2 })

    expect(rows[0].plus).toBeUndefined()
    expect(rows[1].plus).toBeUndefined()
    expect(rows[2].plus).toBeCloseTo(1.3333333333333333, 12)
    expect(rows[2].minus).toBeCloseTo(0.5, 12)
    expect(rows[3].plus).toBeCloseTo(1.1428571428571428, 12)
    expect(rows[3].minus).toBeCloseTo(0.5714285714285714, 12)
  })
})
