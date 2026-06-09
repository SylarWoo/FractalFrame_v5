import { beforeEach, describe, expect, it } from 'vitest'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { clearRealtimeIndicatorStableCacheV2, refreshRealtimeWindowIndicatorsWithStableCacheV2 } from './realtimeIndicatorStableCacheV2'

function kline(time: number, close: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close,
    globalIndex: null,
    high: close,
    low: close,
    open: close,
    period: 'M5',
    source: 'mt5-realtime-window-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: close,
  }
}

function windowFromRows(rows: StoreV6WindowKLine[]): StoreV6RealtimePageWindow {
  const stableRows = rows.slice(0, -1)
  const tailRow = rows[rows.length - 1] ?? null
  return {
    activeRows: rows,
    indicatorRequests: [{ id: 'TEST' }],
    indicators: {},
    key: `realtime:${rows.map((row) => `${row.time}:${row.close}`).join(',')}`,
    period: 'M5',
    renderData: {
      indicators: {},
      klineRows: rows,
    },
    sessionTimeFrom: 100,
    sessionTimeTo: null,
    source: 'store-v6-realtime-page-window-v2',
    stableRows,
    status: rows.length ? 'ready' : 'closed-empty',
    symbol: 'XAUUSDm',
    tailRow,
  }
}

describe('refreshRealtimeWindowIndicatorsWithStableCacheV2', () => {
  beforeEach(() => {
    clearRealtimeIndicatorStableCacheV2()
  })

  it('reuses stable indicator rows and recalculates only the tail row while stable rows are unchanged', async () => {
    const calls: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        calls.push(context.activeRows.length)
        return {
          TEST: {
            displayRows: context.activeRows.map((row) => ({ barKey: row.barKey, value: row.close })),
            key: `TEST:${context.activeRows.map((row) => row.time).join(',')}`,
            rows: context.activeRows.map((row) => ({ barKey: row.barKey, value: row.close })),
            source: 'test',
          },
        }
      },
      id: 'TEST',
    })

    const first = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      window: windowFromRows([kline(100, 1), kline(200, 2), kline(300, 3)]),
    })
    const second = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      window: windowFromRows([kline(100, 1), kline(200, 2), kline(300, 4)]),
    })

    expect(calls).toEqual([2, 1, 1])
    expect(first.indicators.TEST.displayRows).toEqual([
      { barKey: 'XAUUSDm|M5|100', value: 1 },
      { barKey: 'XAUUSDm|M5|200', value: 2 },
      { barKey: 'XAUUSDm|M5|300', value: 3 },
    ])
    expect(second.indicators.TEST.displayRows).toEqual([
      { barKey: 'XAUUSDm|M5|100', value: 1 },
      { barKey: 'XAUUSDm|M5|200', value: 2 },
      { barKey: 'XAUUSDm|M5|300', value: 4 },
    ])
  })

  it('merges Morgan Range segment rows by shifting tail segment indices into the active window', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        const first = context.activeRows[0]
        if (!first) {
          return {
            MR_M5: {
              displayRows: [],
              key: 'MR_M5:empty',
              rows: [],
              source: 'test',
            },
          }
        }
        return {
          MR_M5: {
            displayRows: [{
              atr7: 1,
              center: first.close,
              endIndex: Math.max(0, context.activeRows.length - 1),
              index: 1,
              levels: [],
              lower: first.close - 1,
              range: 1,
              startIndex: 0,
              startTimestamp: first.timestamp,
              trueRange: 1,
              upper: first.close + 1,
            }],
            key: `MR_M5:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'MR-M5',
    })

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      requests: [{ id: 'MR-M5' }],
      window: windowFromRows([kline(21_000, 1), kline(21_300, 2), kline(21_600, 3)]),
    })

    expect(next.indicators.MR_M5.displayRows).toEqual([
      expect.objectContaining({ endIndex: 1, startIndex: 0, startTimestamp: 21_000_000 }),
      expect.objectContaining({ endIndex: 2, startIndex: 2, startTimestamp: 21_600_000 }),
    ])
  })

  it('does not recalculate Morgan Range tail rows when the tail is not an H4 boundary', async () => {
    const calls: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        calls.push(context.activeRows.length)
        return {
          MR_M5: {
            displayRows: context.activeRows.length > 1 ? [{
              atr7: 1,
              center: 1,
              endIndex: context.activeRows.length - 1,
              index: 1,
              levels: [],
              lower: 0,
              range: 1,
              startIndex: 0,
              startTimestamp: context.activeRows[0]?.timestamp ?? 0,
              trueRange: 1,
              upper: 2,
            }] : [],
            key: `MR_M5:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'MR-M5',
    })

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      requests: [{ id: 'MR-M5' }],
      window: windowFromRows([kline(21_000, 1), kline(21_300, 2), kline(21_900, 3)]),
    })

    expect(calls).toEqual([2])
    expect(next.indicators.MR_M5.displayRows).toEqual([
      expect.objectContaining({ endIndex: 1, startIndex: 0, startTimestamp: 21_000_000 }),
    ])
  })

  it('passes only the requested warmup tail context into tail indicator recalculation', async () => {
    const historyLengths: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        historyLengths.push(context.historyRows.length)
        return {
          TEST: {
            displayRows: context.activeRows.map((row) => ({ barKey: row.barKey, value: row.close })),
            key: `TEST:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'TEST',
      warmup: {
        mode: 'fixedRows',
        realtimeRows: 2,
      },
    })

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0), kline(300, 1), kline(600, 2)],
      registry,
      window: windowFromRows([kline(900, 3), kline(1200, 4), kline(1500, 5), kline(1800, 6)]),
    })

    expect(historyLengths).toEqual([3, 2])
  })

  it('keeps stable realtime rows as VWAP tail context even though VWAP does not request StoreV6 warmup', async () => {
    const historyLengths: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        historyLengths.push(context.historyRows.length)
        return {
          VWAP: {
            displayRows: context.activeRows.map((row) => ({ barKey: row.barKey, historyRows: context.historyRows.length })),
            key: `VWAP:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'VWAP',
      warmup: {
        mode: 'none',
        realtimeRows: 0,
      },
    })

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [],
      registry,
      requests: [{ id: 'VWAP' }],
      window: windowFromRows([kline(900, 3), kline(1200, 4), kline(1500, 5)]),
    })

    expect(historyLengths).toEqual([0, 2])
  })
})
