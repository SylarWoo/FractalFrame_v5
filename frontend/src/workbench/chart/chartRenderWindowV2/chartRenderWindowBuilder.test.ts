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
})
