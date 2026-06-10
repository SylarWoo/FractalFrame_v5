import { describe, expect, it } from 'vitest'
import type { StoreV6RealtimePageWindow } from './realtimePageWindowTypes'
import {
  isRealtimeWindowStructurallyInconsistent,
  resolveAutoRebuildRealtimeStablePageReason,
  shouldAutoRebuildRealtimeStablePage,
} from './realtimeStablePageRebuildHeuristics'

function kline(time: number) {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: time,
    globalIndex: null,
    high: time,
    low: time,
    open: time,
    period: 'M5',
    source: 'mt5-realtime-window-v2' as const,
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 1,
  }
}

function realtimeWindow(): StoreV6RealtimePageWindow {
  const stableRows = [kline(100), kline(200)]
  const tailRow = kline(300)
  return {
    activeRows: [...stableRows, tailRow],
    indicatorRequests: [],
    indicators: {},
    key: 'realtime-window:test',
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
    updateKind: 'realtime-tail-tick',
  }
}

describe('realtimeStablePageRebuildHeuristics', () => {
  it('detects structural drift when active rows no longer match stable plus tail', () => {
    const window = {
      ...realtimeWindow(),
      activeRows: [kline(100), kline(200)],
    } satisfies StoreV6RealtimePageWindow

    expect(isRealtimeWindowStructurallyInconsistent(window)).toBe(true)
  })

  it('detects structural drift when stable rows overrun the current tail time', () => {
    const window = {
      ...realtimeWindow(),
      stableRows: [kline(100), kline(300)],
      activeRows: [kline(100), kline(300), kline(300)],
    } satisfies StoreV6RealtimePageWindow

    expect(isRealtimeWindowStructurallyInconsistent(window)).toBe(true)
  })

  it('requests an automatic rebuild when monitor data shows more completed rows than the current stable page', () => {
    expect(shouldAutoRebuildRealtimeStablePage({
      monitor: {
        rangeTimeFrom: 100,
        rangeTimeTo: 400,
        rows: 4,
        sessionTimeFrom: 100,
        tailTime: 500,
      },
      window: realtimeWindow(),
    })).toBe(true)
    expect(resolveAutoRebuildRealtimeStablePageReason({
      monitor: {
        rangeTimeFrom: 100,
        rangeTimeTo: 400,
        rows: 4,
        sessionTimeFrom: 100,
        tailTime: 500,
      },
      window: realtimeWindow(),
    })).toBe('monitor_rows_ahead')
  })

  it('does not request an automatic rebuild when the current window already matches the monitor snapshot', () => {
    expect(shouldAutoRebuildRealtimeStablePage({
      monitor: {
        rangeTimeFrom: 100,
        rangeTimeTo: 200,
        rows: 2,
        sessionTimeFrom: 100,
        tailTime: 300,
      },
      window: realtimeWindow(),
    })).toBe(false)
  })

  it('reports a structure reason before monitor comparisons', () => {
    const window = {
      ...realtimeWindow(),
      activeRows: [kline(100), kline(200)],
    } satisfies StoreV6RealtimePageWindow

    expect(resolveAutoRebuildRealtimeStablePageReason({
      monitor: {
        rangeTimeFrom: 100,
        rangeTimeTo: 200,
        rows: 2,
        sessionTimeFrom: 100,
        tailTime: 300,
      },
      window,
    })).toBe('window_structure_inconsistent')
  })
})
