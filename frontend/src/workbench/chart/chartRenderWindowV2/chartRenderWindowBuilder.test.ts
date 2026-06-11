import { describe, expect, it } from 'vitest'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import { buildChartRenderWindowV2 } from './chartRenderWindowBuilder'

function kline(time: number, source: StoreV6WindowKLine['source']): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    globalIndex: time,
    high: 3,
    low: 1,
    open: 1.5,
    period: 'M5',
    source,
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 10,
  }
}

describe('buildChartRenderWindowV2', () => {
  it('merges history and realtime indicator series by kline identity', () => {
    const historyRows = [kline(100, 'store-v6-page-slice-v2'), kline(200, 'store-v6-page-slice-v2')]
    const realtimeRows = [kline(200, 'mt5-realtime-window-v2'), kline(300, 'mt5-realtime-window-v2')]
    const historyWindow: StoreV6HistoryPageWindow = {
      boundary: {
        actualFromGlobalIndex: 100,
        actualTimeFrom: 100,
        actualTimeTo: 200,
        actualToGlobalIndex: 200,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 100,
        requestedTimeTo: 200,
        requestedToGlobalIndex: null,
      },
      calculationRows: historyRows,
      displayOffset: 0,
      historyRows,
      indicators: {
        TEST: {
          key: 'TEST',
          rows: [{ barKey: 'XAUUSDm|M5|100', value: 1 }, { barKey: 'XAUUSDm|M5|200', value: 2 }],
          source: 'history-test',
        },
      },
      key: 'history',
      page: {
        fromGlobalIndex: 100,
        index: 1,
        limit: historyRows.length,
        pageType: 'history',
        realtime: false,
        rows: historyRows.length,
        timeFrom: 100,
        timeTo: 200,
        toGlobalIndex: 200,
      },
      pageIndex: 1,
      period: 'M5',
      renderData: {
        indicators: {
          TEST: {
            key: 'TEST',
            rows: [{ barKey: 'XAUUSDm|M5|100', value: 1 }, { barKey: 'XAUUSDm|M5|200', value: 2 }],
            source: 'history-test',
          },
        },
        klineRows: historyRows,
      },
      source: 'store-v6-history-page-window-v2',
      status: 'ready',
      symbol: 'XAUUSDm',
      warmupRows: [],
    }
    const realtimeWindow: StoreV6RealtimePageWindow = {
      activeRows: realtimeRows,
      indicatorRequests: [],
      indicators: {
        TEST: {
          key: 'TEST',
          rows: [{ barKey: 'XAUUSDm|M5|200', value: 20 }, { barKey: 'XAUUSDm|M5|300', value: 30 }],
          source: 'realtime-test',
        },
      },
      key: 'realtime',
      period: 'M5',
      renderData: {
        indicators: {
          TEST: {
            key: 'TEST',
            rows: [{ barKey: 'XAUUSDm|M5|200', value: 20 }, { barKey: 'XAUUSDm|M5|300', value: 30 }],
            source: 'realtime-test',
          },
        },
        klineRows: realtimeRows,
      },
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      source: 'store-v6-realtime-page-window-v2',
      stableRows: realtimeRows.slice(0, -1),
      status: 'ready',
      symbol: 'XAUUSDm',
      tailRow: realtimeRows[realtimeRows.length - 1],
    }

    const renderWindow = buildChartRenderWindowV2({ historyWindow, realtimeWindow })

    expect(renderWindow.indicators.TEST.rows).toEqual([
      { barKey: 'XAUUSDm|M5|100', value: 1 },
      { barKey: 'XAUUSDm|M5|200', value: 20 },
      { barKey: 'XAUUSDm|M5|300', value: 30 },
    ])
    expect(renderWindow.rows.map((row) => [row.time, row.windowSource])).toEqual([
      [100, 'history'],
      [200, 'realtime'],
      [300, 'realtime'],
    ])
  })

  it('translates Morgan Range realtime segment indices into render window index space', () => {
    const historyRows = [kline(100, 'store-v6-page-slice-v2'), kline(200, 'store-v6-page-slice-v2')]
    const realtimeRows = [kline(300, 'mt5-realtime-window-v2'), kline(400, 'mt5-realtime-window-v2')]
    const historyWindow = {
      boundary: {
        actualFromGlobalIndex: 100,
        actualTimeFrom: 100,
        actualTimeTo: 200,
        actualToGlobalIndex: 200,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 100,
        requestedTimeTo: 200,
        requestedToGlobalIndex: null,
      },
      calculationRows: historyRows,
      displayOffset: 0,
      historyRows,
      indicators: {},
      key: 'history',
      page: {
        fromGlobalIndex: 100,
        index: 1,
        limit: historyRows.length,
        pageType: 'history',
        realtime: false,
        rows: historyRows.length,
        timeFrom: 100,
        timeTo: 200,
        toGlobalIndex: 200,
      },
      pageIndex: 1,
      period: 'M5',
      renderData: {
        indicators: {
          MR_M5: {
            key: 'history-mr',
            rows: [{ center: 10, endIndex: 1, lower: 8, startIndex: 0, startTimestamp: 100_000, upper: 12 }],
            source: 'history-test',
          },
        },
        klineRows: historyRows,
      },
      source: 'store-v6-history-page-window-v2',
      status: 'ready',
      symbol: 'XAUUSDm',
      warmupRows: [],
    } satisfies StoreV6HistoryPageWindow
    const realtimeWindow = {
      activeRows: realtimeRows,
      indicatorRequests: [],
      indicators: {},
      key: 'realtime',
      period: 'M5',
      renderData: {
        indicators: {
          MR_M5: {
            key: 'realtime-mr',
            rows: [{ center: 20, endIndex: 1, lower: 18, startIndex: 0, startTimestamp: 300_000, upper: 22 }],
            source: 'realtime-test',
          },
        },
        klineRows: realtimeRows,
      },
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      source: 'store-v6-realtime-page-window-v2',
      stableRows: realtimeRows.slice(0, -1),
      status: 'ready',
      symbol: 'XAUUSDm',
      tailRow: realtimeRows[realtimeRows.length - 1],
    } satisfies StoreV6RealtimePageWindow

    const renderWindow = buildChartRenderWindowV2({ historyWindow, realtimeWindow })

    expect(renderWindow.rows.map((row) => row.timestamp)).toEqual([100_000, 200_000, 300_000, 400_000])
    expect(renderWindow.indicators.MR_M5.rows).toEqual([
      expect.objectContaining({ endIndex: 1, startIndex: 0, startTimestamp: 100_000 }),
      expect.objectContaining({ endIndex: 3, startIndex: 2, startTimestamp: 300_000 }),
    ])
  })

  it('deduplicates overlapping Morgan Range history and realtime segments by start timestamp', () => {
    const historyRows = [kline(100, 'store-v6-page-slice-v2'), kline(200, 'store-v6-page-slice-v2')]
    const realtimeRows = [kline(200, 'mt5-realtime-window-v2'), kline(300, 'mt5-realtime-window-v2')]
    const historyWindow = {
      boundary: {
        actualFromGlobalIndex: 100,
        actualTimeFrom: 100,
        actualTimeTo: 200,
        actualToGlobalIndex: 200,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 100,
        requestedTimeTo: 200,
        requestedToGlobalIndex: null,
      },
      calculationRows: historyRows,
      displayOffset: 0,
      historyRows,
      indicators: {},
      key: 'history',
      page: {
        fromGlobalIndex: 100,
        index: 1,
        limit: historyRows.length,
        pageType: 'history',
        realtime: false,
        rows: historyRows.length,
        timeFrom: 100,
        timeTo: 200,
        toGlobalIndex: 200,
      },
      pageIndex: 1,
      period: 'M30',
      renderData: {
        indicators: {
          MR_M30: {
            key: 'history-mr',
            rows: [{ center: 10, endIndex: 1, lower: 8, startIndex: 1, startTimestamp: 200_000, upper: 12 }],
            source: 'history-test',
          },
        },
        klineRows: historyRows,
      },
      source: 'store-v6-history-page-window-v2',
      status: 'ready',
      symbol: 'XAUUSDm',
      warmupRows: [],
    } satisfies StoreV6HistoryPageWindow
    const realtimeWindow = {
      activeRows: realtimeRows,
      indicatorRequests: [],
      indicators: {},
      key: 'realtime',
      period: 'M30',
      renderData: {
        indicators: {
          MR_M30: {
            key: 'realtime-mr',
            rows: [{ center: 20, endIndex: 1, lower: 18, startIndex: 0, startTimestamp: 200_000, upper: 22 }],
            source: 'realtime-test',
          },
        },
        klineRows: realtimeRows,
      },
      sessionTimeFrom: 200,
      sessionTimeTo: null,
      source: 'store-v6-realtime-page-window-v2',
      stableRows: realtimeRows.slice(0, -1),
      status: 'ready',
      symbol: 'XAUUSDm',
      tailRow: realtimeRows[realtimeRows.length - 1],
    } satisfies StoreV6RealtimePageWindow

    const renderWindow = buildChartRenderWindowV2({ historyWindow, realtimeWindow })

    expect(renderWindow.indicators.MR_M30.rows).toEqual([
      expect.objectContaining({ center: 20, startIndex: 1, startTimestamp: 200_000 }),
    ])
  })
})
