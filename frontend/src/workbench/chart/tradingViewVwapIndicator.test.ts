import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateTradingViewVwapRows } from './tradingViewVwapIndicator'

function row(timestamp: number, close: number): KLineData {
  return {
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
  }
}

describe('calculateTradingViewVwapRows', () => {
  it('resets session VWAP on the UTC2200 daily open for non-crypto symbols', () => {
    const rows = calculateTradingViewVwapRows(
      [
        row(Date.UTC(2024, 0, 1, 18), 100),
        row(Date.UTC(2024, 0, 1, 22), 200),
        row(Date.UTC(2024, 0, 2, 2), 300),
      ],
      { anchorPeriod: 'session', source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 200, 250])
  })

  it('keeps crypto session VWAP anchored to UTC midnight', () => {
    const rows = calculateTradingViewVwapRows(
      [
        row(Date.UTC(2024, 0, 1, 18), 100),
        row(Date.UTC(2024, 0, 1, 22), 200),
        row(Date.UTC(2024, 0, 2, 0), 300),
      ],
      { anchorPeriod: 'session', source: 'close', symbol: 'BTCUSDT' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 150, 300])
  })
})
