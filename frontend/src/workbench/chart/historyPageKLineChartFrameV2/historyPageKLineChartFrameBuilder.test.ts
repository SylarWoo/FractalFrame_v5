import { describe, expect, it } from 'vitest'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { buildKLineChartHistoryFrame } from './historyPageKLineChartFrameBuilder'

function row(time: number, globalIndex: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    globalIndex,
    high: 3,
    low: 1,
    open: 1.5,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 10,
  }
}

function windowData(): StoreV6HistoryPageWindow {
  const rows = [row(400, 2), row(100, 1)]
  return {
    boundary: {
      actualFromGlobalIndex: 1,
      actualTimeFrom: 100,
      actualTimeTo: 400,
      actualToGlobalIndex: 2,
      requestedFromGlobalIndex: null,
      requestedTimeFrom: 100,
      requestedTimeTo: 400,
      requestedToGlobalIndex: null,
    },
    calculationRows: rows,
    displayOffset: 0,
    historyRows: rows,
    indicators: {
      TEST: {
        displayRows: [{ value: 1 }],
        key: 'TEST:1',
        rows: [{ value: 0 }, { value: 1 }],
        source: 'test',
      },
    },
    key: 'history-window-v2:XAUUSDm|M5|1|time|100|400',
    pageIndex: 1,
    period: 'M5',
    renderData: {
      indicators: {
        TEST: {
          displayRows: [{ value: 1 }],
          key: 'TEST:1',
          rows: [{ value: 0 }, { value: 1 }],
          source: 'test',
        },
      },
      klineRows: rows,
    },
    source: 'store-v6-history-page-window-v2',
    status: 'ready',
    symbol: 'XAUUSDm',
    warmupRows: [],
  }
}

describe('buildKLineChartHistoryFrame', () => {
  it('translates a history page window into KLineCharts main rows and alignment indexes', () => {
    const frame = buildKLineChartHistoryFrame(windowData())

    expect(frame.source).toBe('history-page-kline-chart-frame-v2')
    expect(frame.mainRows).toEqual([
      {
        close: 2,
        high: 3,
        low: 1,
        open: 1.5,
        timestamp: 100_000,
        turnover: undefined,
        volume: 10,
      },
      {
        close: 2,
        high: 3,
        low: 1,
        open: 1.5,
        timestamp: 400_000,
        turnover: undefined,
        volume: 10,
      },
    ])
    expect(frame.alignment.timestampToDataIndex.get(100_000)).toBe(0)
    expect(frame.alignment.timestampToDataIndex.get(400_000)).toBe(1)
    expect(frame.alignment.globalIndexToDataIndex.get(1)).toBe(0)
    expect(frame.alignment.globalIndexToDataIndex.get(2)).toBe(1)
    expect(frame.alignment.barKeyToDataIndex.get('XAUUSDm|M5|100')).toBe(0)
    expect(frame.alignment.dataIndexToTimestamp).toEqual([100_000, 400_000])
    expect(frame.panes.TEST.rows).toEqual([{ value: 1 }])
  })
})

