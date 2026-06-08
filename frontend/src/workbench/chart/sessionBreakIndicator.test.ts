import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { isSessionBreakRow } from './sessionBreakIndicator'

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
