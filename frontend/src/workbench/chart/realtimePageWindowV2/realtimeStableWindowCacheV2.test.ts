import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoreV6RealtimePageWindow } from './realtimePageWindowTypes'
import {
  clearRealtimeStableWindowCacheV2,
  readCachedRealtimeRowsV2,
  readRealtimeStableWindowSnapshotV2,
  writeRealtimeStablePageSnapshotV2,
  writeRealtimeTailRuntimeCacheV2,
} from './realtimeStableWindowCacheV2'

function kline(time: number) {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    globalIndex: time,
    high: 3,
    low: 1,
    open: 1.5,
    period: 'M5',
    source: 'mt5-realtime-window-v2' as const,
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 10,
  }
}

function realtimeWindow(): StoreV6RealtimePageWindow {
  const stableRows = [kline(100), kline(200)]
  const tailRow = kline(300)
  return {
    activeRows: [...stableRows, tailRow],
    indicatorRequests: [],
    indicators: {},
    key: 'realtime-window-v2:test',
    period: 'M5',
    renderData: {
      indicators: {},
      klineRows: [...stableRows, tailRow],
    },
    sessionTimeFrom: 100,
    sessionTimeTo: null,
    source: 'store-v6-realtime-page-window-v2',
    stableRows,
    status: 'ready',
    symbol: 'XAUUSDm',
    tailRow,
  }
}

describe('realtimeStableWindowCacheV2', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key)
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value)
        },
      },
    })
  })

  afterEach(() => {
    clearRealtimeStableWindowCacheV2()
    vi.unstubAllGlobals()
  })

  it('restores stable realtime rows and tail runtime separately', () => {
    const window = realtimeWindow()
    writeRealtimeStablePageSnapshotV2(window)
    writeRealtimeTailRuntimeCacheV2(window)

    expect(readCachedRealtimeRowsV2({
      period: 'M5',
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).toEqual({
      stableRows: window.stableRows,
      tailRow: window.tailRow,
    })
  })

  it('keeps stable realtime rows when tail runtime is missing', () => {
    const window = realtimeWindow()
    writeRealtimeStablePageSnapshotV2(window)

    expect(readRealtimeStableWindowSnapshotV2({
      period: 'M5',
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).toEqual({
      savedAt: expect.any(String),
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      stableRows: window.stableRows,
      tailRow: null,
    })
  })

  it('replaces the previous cycle snapshot for the same symbol and period', () => {
    const first = realtimeWindow()
    const second = {
      ...realtimeWindow(),
      activeRows: [kline(400), kline(500)],
      renderData: {
        indicators: {},
        klineRows: [kline(400), kline(500)],
      },
      sessionTimeFrom: 400,
      stableRows: [kline(400)],
      tailRow: kline(500),
    } satisfies StoreV6RealtimePageWindow

    writeRealtimeStablePageSnapshotV2(first)
    writeRealtimeTailRuntimeCacheV2(first)
    writeRealtimeStablePageSnapshotV2(second)
    writeRealtimeTailRuntimeCacheV2(second)

    expect(readCachedRealtimeRowsV2({
      period: 'M5',
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).toEqual({
      stableRows: [],
      tailRow: null,
    })

    expect(readCachedRealtimeRowsV2({
      period: 'M5',
      sessionTimeFrom: 400,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).toEqual({
      stableRows: second.stableRows,
      tailRow: second.tailRow,
    })
  })

  it('clears only the requested symbol and period scope', () => {
    const base = realtimeWindow()
    const otherPeriod = {
      ...realtimeWindow(),
      period: 'M30',
    } satisfies StoreV6RealtimePageWindow
    const otherSymbol = {
      ...realtimeWindow(),
      symbol: 'EURUSDm',
    } satisfies StoreV6RealtimePageWindow

    writeRealtimeStablePageSnapshotV2(base)
    writeRealtimeTailRuntimeCacheV2(base)
    writeRealtimeStablePageSnapshotV2(otherPeriod)
    writeRealtimeTailRuntimeCacheV2(otherPeriod)
    writeRealtimeStablePageSnapshotV2(otherSymbol)
    writeRealtimeTailRuntimeCacheV2(otherSymbol)

    clearRealtimeStableWindowCacheV2({
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    expect(readCachedRealtimeRowsV2({
      period: 'M5',
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).toEqual({
      stableRows: [],
      tailRow: null,
    })
    expect(readCachedRealtimeRowsV2({
      period: 'M30',
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).toEqual({
      stableRows: otherPeriod.stableRows,
      tailRow: otherPeriod.tailRow,
    })
    expect(readCachedRealtimeRowsV2({
      period: 'M5',
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'EURUSDm',
    })).toEqual({
      stableRows: otherSymbol.stableRows,
      tailRow: otherSymbol.tailRow,
    })
  })
})
