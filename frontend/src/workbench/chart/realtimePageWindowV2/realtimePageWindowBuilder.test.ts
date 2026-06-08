import { describe, expect, it } from 'vitest'
import { buildStoreV6RealtimePageWindow, resolveActiveM5RealtimeSessionStartSeconds, resolveNextM5RealtimeSessionStartSeconds } from './realtimePageWindowBuilder'

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

describe('buildStoreV6RealtimePageWindow', () => {
  it('creates an empty active session window without fake kline rows', () => {
    const window = buildStoreV6RealtimePageWindow({
      enabled: true,
      indicatorRequests: [{ id: 'test' }],
      period: 'M5',
      sessionTimeFrom: 1_000,
      sessionTimeTo: 2_000,
      symbol: 'XAUUSDm',
    })

    expect(window?.source).toBe('store-v6-realtime-page-window-v2')
    expect(window?.status).toBe('closed-empty')
    expect(window?.activeRows).toEqual([])
    expect(window?.indicatorRequests).toEqual([{ id: 'test' }])
    expect(window?.indicators).toEqual({})
    expect(window?.renderData.indicators).toBe(window?.indicators)
    expect(window?.renderData.klineRows).toEqual([])
    expect(window?.sessionTimeFrom).toBe(1_300)
    expect(window?.sessionTimeTo).toBe(2_000)
  })

  it('returns null when realtime window is disabled', () => {
    expect(buildStoreV6RealtimePageWindow({
      enabled: false,
      period: 'M5',
      symbol: 'XAUUSDm',
    })).toBeNull()
  })

  it('skips the daily M5 maintenance gap', () => {
    expect(resolveNextM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 2, 4, 55)))
      .toBe(shanghaiSeconds(2026, 6, 2, 6, 0))
  })

  it('skips the weekend M5 closed gap', () => {
    expect(resolveNextM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 6, 4, 55)))
      .toBe(shanghaiSeconds(2026, 6, 8, 6, 0))
  })

  it('keeps 24/7 crypto M5 sessions continuous through weekends and the 05:00 hour', () => {
    expect(resolveNextM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 6, 4, 55), 'BTCUSDm'))
      .toBe(shanghaiSeconds(2026, 6, 6, 5, 0))
    expect(resolveNextM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 7, 23, 55), 'BTCUSDm'))
      .toBe(shanghaiSeconds(2026, 6, 8, 0, 0))
  })

  it('rolls 24/7 crypto session windows on the Shanghai 06:00 boundary', () => {
    expect(resolveNextM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 8, 5, 55), 'BTCUSDm'))
      .toBe(shanghaiSeconds(2026, 6, 8, 6, 0))
  })

  it('resolves the active realtime window start from the current trading-day boundary', () => {
    expect(resolveActiveM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 8, 18, 40), 'BTCUSDm'))
      .toBe(shanghaiSeconds(2026, 6, 8, 6, 0))
  })
})
