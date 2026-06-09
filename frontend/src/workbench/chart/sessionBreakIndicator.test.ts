import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { filterSessionBreakCoordinatesForRealtimeSeparator, isSessionBreakRow } from './sessionBreakIndicator'

type TestSessionBreakRow = KLineData & {
  tradingDay?: string
}

function row(timestamp: number, extra: Partial<TestSessionBreakRow> = {}): KLineData {
  return {
    close: 1,
    high: 1,
    low: 1,
    open: 1,
    timestamp,
    ...extra,
  }
}

describe('isSessionBreakRow', () => {
  it('uses StoreV6 tradingDay as the authoritative break key for gold', () => {
    expect(isSessionBreakRow(
      row(Date.UTC(2026, 0, 1, 21, 55), { tradingDay: '2026-01-01' }),
      row(Date.UTC(2026, 0, 1, 22, 0), { tradingDay: '2026-01-02' }),
      'XAUUSDm',
    )).toBe(true)
  })

  it('uses StoreV6 tradingDay as the authoritative break key for 24/7 crypto', () => {
    expect(isSessionBreakRow(
      row(Date.UTC(2026, 0, 1, 23, 55), { tradingDay: '2026-01-01' }),
      row(Date.UTC(2026, 0, 2, 0, 0), { tradingDay: '2026-01-02' }),
      'BTCUSDm',
    )).toBe(true)
  })

  it('does not force a crypto break at UTC 22 when tradingDay remains the same', () => {
    expect(isSessionBreakRow(
      row(Date.UTC(2026, 0, 1, 21, 55), { tradingDay: '2026-01-01' }),
      row(Date.UTC(2026, 0, 1, 22, 0), { tradingDay: '2026-01-01' }),
      'BTCUSDm',
    )).toBe(false)
  })

  it('falls back to symbol anchor rules when StoreV6 session identity is missing', () => {
    expect(isSessionBreakRow(
      row(Date.UTC(2026, 0, 1, 21, 55)),
      row(Date.UTC(2026, 0, 1, 22, 0)),
      'XAUUSDm',
    )).toBe(true)
    expect(isSessionBreakRow(
      row(Date.UTC(2026, 0, 1, 21, 55)),
      row(Date.UTC(2026, 0, 1, 22, 0)),
      'BTCUSDm',
    )).toBe(true)
  })
})

describe('filterSessionBreakCoordinatesForRealtimeSeparator', () => {
  it('lets realtime window separator take over the latest session break line', () => {
    expect(filterSessionBreakCoordinatesForRealtimeSeparator([
      { index: 10, timestampSeconds: 1000, x: 100.5 },
      { index: 20, timestampSeconds: 2000, x: 200.5 },
      { index: 30, timestampSeconds: 3000, x: 300.5 },
    ], true, 3000)).toEqual([
      { index: 10, timestampSeconds: 1000, x: 100.5 },
      { index: 20, timestampSeconds: 2000, x: 200.5 },
    ])
  })

  it('keeps all session break lines when realtime window separator is disabled', () => {
    const coords = [
      { index: 10, timestampSeconds: 1000, x: 100.5 },
      { index: 20, timestampSeconds: 2000, x: 200.5 },
    ]
    expect(filterSessionBreakCoordinatesForRealtimeSeparator(coords, false, 2000)).toEqual(coords)
  })
})
