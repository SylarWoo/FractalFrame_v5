import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryMt5Rates, queryStoreV6Ohlcv } from '../../../services/mt5/mt5SymbolsApi'
import {
  createStoreV6IndicatorRegistryV2,
  requestRealtimeWindowIndicatorsV2,
  storeV6MorganRangeM5IndicatorDefinitionV2,
  storeV6MorganRangeM5RequestIdV2,
  storeV6VdoIndicatorDefinitionV2,
  storeV6VdoIndicatorIdV2,
  storeV6VmiIndicatorDefinitionV2,
  storeV6VmiIndicatorIdV2,
} from '../indicatorRequestV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import {
  buildStoreV6RealtimePageWindow,
  mergeMt5RealtimeTickIntoWindow,
  rebuildStoreV6RealtimeStablePageWindow,
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
const queryMt5RatesMock = vi.mocked(queryMt5Rates)

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
    queryMt5RatesMock.mockReset()
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

  it('keeps an explicit M30 weekly realtime open boundary without adding another bar', () => {
    const sessionStart = shanghaiSeconds(2026, 6, 8, 6, 0)
    const window = buildStoreV6RealtimePageWindow({
      enabled: true,
      period: 'M30',
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
    expect(first.updateKind).toBe('realtime-tail-tick')
    expect(second.updateKind).toBe('realtime-tail-tick')
  })

  it('increments realtime tick volume when MT5 ticks do not provide volume', () => {
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
      volume: 0,
    })
    const second = mergeMt5RealtimeTickIntoWindow(first, {
      bid: 2301,
      symbol: 'XAUUSDm',
      time: barTime + 60,
    })
    const nextBar = mergeMt5RealtimeTickIntoWindow(second, {
      bid: 2302,
      symbol: 'XAUUSDm',
      time: barTime + 300,
    })

    expect(second.tailRow?.volume).toBe(2)
    expect(nextBar.tailRow?.volume).toBe(1)
    expect(nextBar.updateKind).toBe('realtime-bar-close-settlement')
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

  it('rebuilds only the current cycle stable realtime page from MT5 bars and keeps the current tail attached', async () => {
    const sessionStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const currentTail = kline(shanghaiSeconds(2026, 6, 9, 10, 10), 9, 'mt5-realtime-window-v2')
    const window = {
      ...buildStoreV6RealtimePageWindow({
        enabled: true,
        period: 'M5',
        sessionTimeFrom: sessionStart,
        symbol: 'XAUUSDm',
      })!,
      activeRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 7, 'mt5-realtime-window-v2'), currentTail],
      indicatorHistoryRows: [kline(shanghaiSeconds(2026, 6, 9, 5, 55), 6)],
      renderData: {
        indicators: {},
        klineRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 7, 'mt5-realtime-window-v2'), currentTail],
      },
      stableRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 7, 'mt5-realtime-window-v2')],
      tailRow: currentTail,
    }

    queryMt5RatesMock.mockResolvedValueOnce({
      rows: [
        { close: 1, high: 1, low: 1, open: 1, time: shanghaiSeconds(2026, 6, 9, 6, 0), volume: 10 },
        { close: 2, high: 2, low: 2, open: 2, time: shanghaiSeconds(2026, 6, 9, 6, 5), volume: 11 },
        { close: 8, high: 8, low: 8, open: 8, time: shanghaiSeconds(2026, 6, 9, 10, 5), volume: 12 },
      ],
    } as never)

    const rebuilt = await rebuildStoreV6RealtimeStablePageWindow({
      enabled: true,
      historyRows: [kline(shanghaiSeconds(2026, 6, 9, 5, 55), 6)],
      indicatorRequests: [],
      period: 'M5',
      sessionTimeFrom: sessionStart,
      symbol: 'XAUUSDm',
    }, window)

    expect(queryMt5RatesMock).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'XAUUSDm',
      timeframe: 'M5',
      timeFrom: sessionStart,
    }))
    expect(rebuilt?.stableRows.map((row) => row.time)).toEqual([
      shanghaiSeconds(2026, 6, 9, 6, 0),
      shanghaiSeconds(2026, 6, 9, 6, 5),
      shanghaiSeconds(2026, 6, 9, 10, 5),
    ])
    expect(rebuilt?.tailRow?.time).toBe(currentTail.time)
    expect(rebuilt?.tailRow?.close).toBe(currentTail.close)
    expect(rebuilt?.updateKind).toBe('stable-page-rebuild')
  })

  it('promotes the MT5 latest row to the rebuilt tail when no runtime tail is available', async () => {
    const sessionStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const window = buildStoreV6RealtimePageWindow({
      enabled: true,
      indicatorRequests: [],
      period: 'M5',
      sessionTimeFrom: sessionStart,
      symbol: 'XAUUSDm',
    })

    queryMt5RatesMock.mockResolvedValueOnce({
      rows: [
        { close: 1, high: 1, low: 1, open: 1, time: shanghaiSeconds(2026, 6, 9, 6, 0), volume: 10 },
        { close: 2, high: 2, low: 2, open: 2, time: shanghaiSeconds(2026, 6, 9, 6, 5), volume: 11 },
      ],
    } as never)

    const rebuilt = await rebuildStoreV6RealtimeStablePageWindow({
      enabled: true,
      indicatorRequests: [],
      period: 'M5',
      sessionTimeFrom: sessionStart,
      symbol: 'XAUUSDm',
    }, window)

    expect(rebuilt?.stableRows.map((row) => row.time)).toEqual([shanghaiSeconds(2026, 6, 9, 6, 0)])
    expect(rebuilt?.tailRow?.time).toBe(shanghaiSeconds(2026, 6, 9, 6, 5))
    expect(rebuilt?.updateKind).toBe('stable-page-rebuild')
  })

  it('rebuilds VDO indicator rows for the current cycle and keeps them aligned with direct realtime calculation', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VdoIndicatorDefinitionV2)
    const sessionStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const settings = { emaSmoothing: 3, length: 5, vdoMa2Length: 4, vdoMaLength: 3 }
    const historyRows = Array.from({ length: 12 }, (_, index) => kline(shanghaiSeconds(2026, 6, 9, 5, 0) + index * 300, 90 + index))
    const runtimeTail = kline(shanghaiSeconds(2026, 6, 9, 10, 10), 109, 'mt5-realtime-window-v2')
    const window = {
      ...buildStoreV6RealtimePageWindow({
        enabled: true,
        historyRows,
        indicatorRegistry: registry,
        indicatorRequests: [{ id: 'VDO', params: settings }],
        period: 'M5',
        sessionTimeFrom: sessionStart,
        symbol: 'XAUUSDm',
      })!,
      activeRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 107, 'mt5-realtime-window-v2'), runtimeTail],
      indicatorHistoryRows: historyRows,
      renderData: {
        indicators: {},
        klineRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 107, 'mt5-realtime-window-v2'), runtimeTail],
      },
      stableRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 107, 'mt5-realtime-window-v2')],
      tailRow: runtimeTail,
    }

    queryMt5RatesMock.mockResolvedValueOnce({
      rows: [
        { close: 101, high: 101, low: 101, open: 101, time: shanghaiSeconds(2026, 6, 9, 6, 0), volume: 10 },
        { close: 102, high: 102, low: 102, open: 102, time: shanghaiSeconds(2026, 6, 9, 6, 5), volume: 11 },
        { close: 108, high: 108, low: 108, open: 108, time: shanghaiSeconds(2026, 6, 9, 10, 5), volume: 12 },
      ],
    } as never)

    const rebuilt = await rebuildStoreV6RealtimeStablePageWindow({
      enabled: true,
      historyRows,
      indicatorRegistry: registry,
      indicatorRequests: [{ id: 'VDO', params: settings }],
      period: 'M5',
      sessionTimeFrom: sessionStart,
      symbol: 'XAUUSDm',
    }, window)

    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: rebuilt?.activeRows ?? [],
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: 'VDO', params: settings }],
      sessionTimeFrom: rebuilt?.sessionTimeFrom ?? sessionStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(rebuilt?.indicators[storeV6VdoIndicatorIdV2].displayRows).toEqual(direct[storeV6VdoIndicatorIdV2].displayRows)
  })

  it('rebuilds VMI indicator rows for the current cycle and keeps them aligned with direct realtime calculation', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VmiIndicatorDefinitionV2)
    const sessionStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const settings = { fastLength: 5, slowLength: 8 }
    const historyRows = Array.from({ length: 16 }, (_, index) => kline(shanghaiSeconds(2026, 6, 9, 4, 40) + index * 300, 120 + index))
    const runtimeTail = kline(shanghaiSeconds(2026, 6, 9, 10, 10), 139, 'mt5-realtime-window-v2')
    const window = {
      ...buildStoreV6RealtimePageWindow({
        enabled: true,
        historyRows,
        indicatorRegistry: registry,
        indicatorRequests: [{ id: 'VMI', params: settings }],
        period: 'M5',
        sessionTimeFrom: sessionStart,
        symbol: 'XAUUSDm',
      })!,
      activeRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 137, 'mt5-realtime-window-v2'), runtimeTail],
      indicatorHistoryRows: historyRows,
      renderData: {
        indicators: {},
        klineRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 137, 'mt5-realtime-window-v2'), runtimeTail],
      },
      stableRows: [kline(shanghaiSeconds(2026, 6, 9, 10, 0), 137, 'mt5-realtime-window-v2')],
      tailRow: runtimeTail,
    }

    queryMt5RatesMock.mockResolvedValueOnce({
      rows: [
        { close: 131, high: 131, low: 131, open: 131, time: shanghaiSeconds(2026, 6, 9, 6, 0), volume: 10 },
        { close: 132, high: 132, low: 132, open: 132, time: shanghaiSeconds(2026, 6, 9, 6, 5), volume: 11 },
        { close: 138, high: 138, low: 138, open: 138, time: shanghaiSeconds(2026, 6, 9, 10, 5), volume: 12 },
      ],
    } as never)

    const rebuilt = await rebuildStoreV6RealtimeStablePageWindow({
      enabled: true,
      historyRows,
      indicatorRegistry: registry,
      indicatorRequests: [{ id: 'VMI', params: settings }],
      period: 'M5',
      sessionTimeFrom: sessionStart,
      symbol: 'XAUUSDm',
    }, window)

    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: rebuilt?.activeRows ?? [],
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: 'VMI', params: settings }],
      sessionTimeFrom: rebuilt?.sessionTimeFrom ?? sessionStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(rebuilt?.indicators[storeV6VmiIndicatorIdV2].displayRows).toEqual(direct[storeV6VmiIndicatorIdV2].displayRows)
  })
})
