import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryStoreV6Ohlcv } from '../../../services/mt5/mt5SymbolsApi'
import { createStoreV6IndicatorRegistryV2, storeV6MorganRangeM5IndicatorDefinitionV2, storeV6MorganRangeM5RequestIdV2 } from '../indicatorRequestV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import {
  buildStoreV6RealtimePageWindow,
  mergeMt5RealtimeTickIntoWindow,
  resolveActiveM5RealtimeSessionStartSeconds,
  resolveRealtimeIndicatorHistoryRowsV2,
  resolveM5RealtimeSessionStartSeconds,
  resolveNextM5RealtimeSessionStartSeconds,
} from './realtimePageWindowBuilder'

vi.mock('../../../services/mt5/mt5SymbolsApi', () => ({
  queryMt5Rates: vi.fn(),
  queryStoreV6Ohlcv: vi.fn(),
}))

const queryStoreMock = vi.mocked(queryStoreV6Ohlcv)

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

function kline(time: number, globalIndex: number, source: StoreV6WindowKLine['source'] = 'store-v6-page-slice-v2'): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2 + globalIndex,
    globalIndex,
    high: 3 + globalIndex,
    low: 1 + globalIndex,
    open: 1.5 + globalIndex,
    period: 'M5',
    source,
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 10,
  }
}

describe('buildStoreV6RealtimePageWindow', () => {
  beforeEach(() => {
    queryStoreMock.mockReset()
  })

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

  it('moves the M5 realtime window to the next open after the current session closes', () => {
    expect(resolveActiveM5RealtimeSessionStartSeconds(shanghaiSeconds(2026, 6, 9, 4, 55), 'XAUUSDm'))
      .toBe(shanghaiSeconds(2026, 6, 9, 6, 0))
    const window = buildStoreV6RealtimePageWindow({
      enabled: true,
      period: 'M5',
      sessionTimeFrom: shanghaiSeconds(2026, 6, 9, 5, 0) - 1,
      symbol: 'XAUUSDm',
    })
    expect(window?.sessionTimeFrom).toBe(shanghaiSeconds(2026, 6, 9, 6, 0))
    expect(window?.activeRows).toEqual([])
    expect(window?.status).toBe('closed-empty')
  })

  it('keeps an explicit M5 realtime open boundary as the realtime window start', () => {
    const sessionStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    expect(resolveM5RealtimeSessionStartSeconds(sessionStart, 'XAUUSDm')).toBe(sessionStart)

    const window = buildStoreV6RealtimePageWindow({
      enabled: true,
      period: 'M5',
      sessionTimeFrom: sessionStart,
      symbol: 'XAUUSDm',
    })

    expect(window?.sessionTimeFrom).toBe(sessionStart)
  })

  it('updates the active realtime tail row from a same-bar tick', () => {
    const sessionStart = shanghaiSeconds(2026, 6, 8, 6, 0)
    const barTime = shanghaiSeconds(2026, 6, 8, 18, 40)
    const window = buildStoreV6RealtimePageWindow({
      enabled: true,
      period: 'M5',
      sessionTimeFrom: sessionStart - 300,
      symbol: 'XAUUSDm',
    })
    expect(window).not.toBeNull()

    const first = mergeMt5RealtimeTickIntoWindow(window!, {
      bid: 2300,
      symbol: 'XAUUSDm',
      time: barTime,
      volume: 10,
    })
    const second = mergeMt5RealtimeTickIntoWindow(first, {
      bid: 2301,
      symbol: 'XAUUSDm',
      time: barTime + 60,
      volume: 11,
    })

    expect(second).not.toBe(first)
    expect(second.activeRows).toHaveLength(1)
    expect(second.tailRow?.time).toBe(barTime)
    expect(second.tailRow?.open).toBe(2300)
    expect(second.tailRow?.high).toBe(2301)
    expect(second.tailRow?.low).toBe(2300)
    expect(second.tailRow?.close).toBe(2301)
    expect(second.tailRow?.volume).toBe(11)
  })

  it('loads realtime indicator warmup from StoreV6 before the first active row', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const sessionStart = shanghaiSeconds(2026, 6, 9, 10, 0)
    const fallbackRows = [kline(shanghaiSeconds(2026, 5, 30, 4, 55), 1)]
    const warmupRows = [kline(sessionStart - 600, 2), kline(sessionStart - 300, 3)]

    queryStoreMock
      .mockResolvedValueOnce({
        metadata: {
          indexFromResult: 4,
          indexToResult: 4,
          timeFromResult: sessionStart,
          timeToResult: sessionStart,
        },
        mode: 'aggregated',
        ok: true,
        rows: [kline(sessionStart, 4)],
        rowsCount: 1,
        symbol: 'XAUUSDm',
        timeframe: 'M5',
      })
      .mockResolvedValueOnce({
        mode: 'aggregated',
        ok: true,
        rows: warmupRows,
        rowsCount: warmupRows.length,
        symbol: 'XAUUSDm',
        timeframe: 'M5',
      })

    const rows = await resolveRealtimeIndicatorHistoryRowsV2({
      activeRows: [kline(sessionStart, 4, 'mt5-realtime-window-v2')],
      request: {
        enabled: true,
        historyRows: fallbackRows,
        indicatorRegistry: registry,
        indicatorRequests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
        period: 'M5',
        sessionTimeFrom: sessionStart,
        symbol: 'XAUUSDm',
      },
    })

    expect(queryStoreMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      limit: 1,
      timeFrom: sessionStart,
      timeTo: sessionStart,
    }))
    expect(queryStoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      limit: 384,
      timeTo: sessionStart - 1,
    }))
    expect(rows.map((row) => row.time)).toEqual(warmupRows.map((row) => row.time))
  })
})
