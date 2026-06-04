import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { enrichRealtimeBarIdentity, normalizeRealtimeBars } from './realtimeBarIdentity'

function row(timestamp: number, close = 10): KLineData {
  return { close, high: close + 1, low: close - 1, open: close, timestamp, volume: 1 }
}

describe('realtimeBarIdentity', () => {
  it('creates provisional identity for tick-created rows', () => {
    const enriched = enrichRealtimeBarIdentity(row(1_700_000_000_000), {
      period: 'M5',
      source: 'mt5Tick',
      symbol: 'XAUUSDm',
    })

    expect(enriched).toMatchObject({
      barKey: 'XAUUSDm|M5|1700000000',
      identityStatus: 'provisional',
      isRealtime: true,
      period: 'M5',
      source: 'mt5Tick',
      symbol: 'XAUUSDm',
      time: 1_700_000_000,
    })
  })

  it('keeps StoreV6 identity as confirmed', () => {
    const enriched = enrichRealtimeBarIdentity({
      ...row(1_700_000_000_000),
      barKey: 'XAUUSDm|M5|1700000000',
      globalIndex: 123,
      sessionId: 'XAUUSDm:2026-06-03',
      tradingDay: '2026-06-03',
    } as KLineData, {
      period: 'M5',
      source: 'storeV6',
      symbol: 'XAUUSDm',
    })

    expect(enriched).toMatchObject({
      globalIndex: 123,
      identityStatus: 'confirmed',
      isClosed: true,
      isRealtime: false,
      sessionId: 'XAUUSDm:2026-06-03',
      source: 'storeV6',
      tradingDay: '2026-06-03',
    })
  })

  it('normalizes duplicate rows by barKey and keeps ordering', () => {
    const rows = normalizeRealtimeBars([
      row(1_700_000_300_000, 30),
      row(1_700_000_000_000, 10),
      row(1_700_000_000_000, 20),
    ], {
      period: '5M',
      source: 'realtimeCache',
      symbol: 'XAUUSDm',
    })

    expect(rows.map((item) => item.close)).toEqual([20, 30])
    expect(rows.map((item) => item.barKey)).toEqual([
      'XAUUSDm|M5|1700000000',
      'XAUUSDm|M5|1700000300',
    ])
  })
})
