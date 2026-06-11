import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateTradingViewVwapRows } from './tradingViewVwapIndicator'

function row(timestamp: number, close: number, volume = 1): KLineData {
  return {
    timestamp,
    open: close,
    high: close,
    low: close,
    close,
    volume,
  }
}

function realtimeRow(timestamp: number, close: number, barKey: string): KLineData {
  return {
    ...row(timestamp, close),
    barKey,
    identityStatus: 'confirmed',
    period: 'M5',
    source: 'realtimeCache',
    symbol: 'XAUUSDm',
    time: timestamp / 1000,
  } as KLineData
}

describe('calculateTradingViewVwapRows', () => {
  it('resets session VWAP on the configured session anchor', () => {
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

  it('resets monthly VWAP at the Shanghai 06:00 month boundary when the month opens on Monday for gold', () => {
    const rows = calculateTradingViewVwapRows(
      [
        row(Date.UTC(2026, 4, 31, 21), 100),
        row(Date.UTC(2026, 4, 31, 22), 200),
        row(Date.UTC(2026, 4, 31, 23), 300),
      ],
      { anchorPeriod: 'month', source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 200, 250])
  })

  it('delays gold monthly VWAP reset to the first Monday 06:00 boundary when month open is not Monday', () => {
    const rows = calculateTradingViewVwapRows(
      [
        row(Date.UTC(2026, 3, 30, 21), 100),
        row(Date.UTC(2026, 3, 30, 22), 200),
        row(Date.UTC(2026, 4, 3, 21), 300),
        row(Date.UTC(2026, 4, 3, 22), 400),
        row(Date.UTC(2026, 4, 3, 23), 500),
      ],
      { anchorPeriod: 'month', source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 150, 200, 400, 450])
  })

  it('keeps crypto monthly VWAP anchored to UTC midnight', () => {
    const rows = calculateTradingViewVwapRows(
      [
        row(Date.UTC(2026, 4, 31, 23), 100),
        row(Date.UTC(2026, 5, 1, 0), 200),
        row(Date.UTC(2026, 5, 1, 1), 300),
      ],
      { anchorPeriod: 'month', source: 'close', symbol: 'BTCUSDm' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 200, 250])
  })

  it('uses StoreV6 tradingDay as the authoritative session boundary', () => {
    const rows = calculateTradingViewVwapRows(
      [
        { ...row(Date.UTC(2024, 0, 1, 18, 0), 100), tradingDay: '2024-01-01' } as KLineData,
        { ...row(Date.UTC(2024, 0, 1, 18, 5), 200), tradingDay: '2024-01-01' } as KLineData,
        { ...row(Date.UTC(2024, 0, 1, 18, 10), 300), tradingDay: '2024-01-02' } as KLineData,
        { ...row(Date.UTC(2024, 0, 1, 18, 15), 500), tradingDay: '2024-01-02' } as KLineData,
      ],
      { anchorPeriod: 'session', period: 'M5', source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 150, 300, 400])
  })

  it('does not reset when StoreV6 session rows continue into realtime rows without session metadata', () => {
    const rows = calculateTradingViewVwapRows(
      [
        { ...row(Date.UTC(2024, 0, 2, 6, 0), 100), tradingDay: '2024-01-01' } as KLineData,
        { ...row(Date.UTC(2024, 0, 2, 6, 5), 200), tradingDay: '2024-01-01' } as KLineData,
        row(Date.UTC(2024, 0, 2, 6, 10), 300),
      ],
      { anchorPeriod: 'session', source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows.map((item) => item.vwap)).toEqual([100, 150, 200])
  })

  it('calculates TradingView-style standard deviation bands from the anchored VWAP window', () => {
    const rows = calculateTradingViewVwapRows(
      [
        row(Date.UTC(2024, 0, 1, 22, 0), 100),
        row(Date.UTC(2024, 0, 1, 22, 5), 200),
      ],
      { anchorPeriod: 'session', band1Multiplier: 1, source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows[1].vwap).toBe(150)
    expect(rows[1].upperBand1).toBe(200)
    expect(rows[1].lowerBand1).toBe(100)
  })

  it('supports percentage bands and secondary multipliers', () => {
    const rows = calculateTradingViewVwapRows(
      [row(Date.UTC(2024, 0, 1, 22, 0), 100)],
      {
        anchorPeriod: 'session',
        band1Multiplier: 1,
        band2Multiplier: 2,
        band3Multiplier: 3,
        bandCalculationMode: 'percentage',
        source: 'close',
        symbol: 'XAUUSDm',
      },
    )

    expect(rows[0]).toMatchObject({
      lowerBand1: 99,
      lowerBand2: 98,
      lowerBand3: 97,
      upperBand1: 101,
      upperBand2: 102,
      upperBand3: 103,
      vwap: 100,
    })
  })

  it('keeps realtime bar identity on VWAP result rows', () => {
    const rows = calculateTradingViewVwapRows(
      [
        realtimeRow(Date.UTC(2024, 0, 1, 22, 0), 100, 'XAUUSDm|M5|1704146400'),
        realtimeRow(Date.UTC(2024, 0, 1, 22, 5), 200, 'XAUUSDm|M5|1704146700'),
      ],
      {
        anchorPeriod: 'session',
        period: 'M5',
        realtimeBarKeyFrom: 'XAUUSDm|M5|1704146400',
        realtimeBarKeyTo: 'XAUUSDm|M5|1704146700',
        realtimeIndicatorPageKey: 'XAUUSDm|M5|realtime|XAUUSDm|M5|1704146400|XAUUSDm|M5|1704146700|2',
        source: 'close',
        symbol: 'XAUUSDm',
      },
    )

    expect(rows.map((item) => item.barKey)).toEqual([
      'XAUUSDm|M5|1704146400',
      'XAUUSDm|M5|1704146700',
    ])
    expect(rows.map((item) => item.vwap)).toEqual([100, 150])
  })

  it('moves calculated rows by offset while preserving target bar identity', () => {
    const rows = calculateTradingViewVwapRows(
      [
        realtimeRow(Date.UTC(2024, 0, 1, 22, 0), 100, 'XAUUSDm|M5|1704146400'),
        realtimeRow(Date.UTC(2024, 0, 1, 22, 5), 200, 'XAUUSDm|M5|1704146700'),
      ],
      { anchorPeriod: 'session', offset: 1, source: 'close', symbol: 'XAUUSDm' },
    )

    expect(rows[0]).toEqual({ barKey: 'XAUUSDm|M5|1704146400' })
    expect(rows[1]).toMatchObject({
      barKey: 'XAUUSDm|M5|1704146700',
      vwap: 100,
    })
  })
})
