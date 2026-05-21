import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateTradingViewMaShiftRows } from './tradingViewMaShiftIndicator'

function row(close: number): KLineData {
  return {
    close,
    high: close,
    low: close,
    open: close,
    timestamp: close * 60_000,
    volume: 1,
  }
}

describe('calculateTradingViewMaShiftRows', () => {
  it('assigns the four MA Shift colors by oscillator quadrant and direction', () => {
    const values = [
      10, 10, 10,
      12, 14, 13, 12,
      10, 10, 10,
      6, 7,
      6, 4,
    ]
    const rows = calculateTradingViewMaShiftRows(values.map(row), {
      length: 3,
      shiftLength: 3,
      shiftMultiplier: 1,
      source: 'close',
      type: 'sma',
    })

    expect(rows.some((item) => item.maColor1 != null)).toBe(true)
    expect(rows.some((item) => item.maColor2 != null)).toBe(true)
    expect(rows.some((item) => item.maColor3 != null)).toBe(true)
    expect(rows.some((item) => item.maColor4 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor1 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor2 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor3 != null)).toBe(true)
    expect(rows.some((item) => item.maFadedColor4 != null)).toBe(true)
  })
})
