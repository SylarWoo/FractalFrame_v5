import { describe, expect, it } from 'vitest'
import { calculateTradingViewMacdRows } from './tradingViewMacdIndicator'

const closeData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close,
  low: close,
  open: close,
  timestamp: index,
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
})
