import { describe, expect, it } from 'vitest'
import type { KLineChartHistoryFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRealtimeFrame } from '../klineChartRealtimeFrameV2'
import { buildKLineChartRenderFrameV2 } from './klineChartRenderFrameBuilder'

function historyFrame(): KLineChartHistoryFrame {
  return {
    alignment: {
      barKeyToDataIndex: new Map([['history:1', 0]]),
      dataIndexToBarKey: ['history:1'],
      dataIndexToGlobalIndex: [1],
      dataIndexToTimestamp: [100_000],
      globalIndexToDataIndex: new Map([[1, 0]]),
      timestampToDataIndex: new Map([[100_000, 0]]),
    },
    key: 'history-frame',
    mainRows: [{ close: 1, high: 2, low: 0.5, open: 1, timestamp: 100_000, volume: 10 }],
    pageIndex: 1,
    panes: {},
    period: 'M5',
    source: 'history-page-kline-chart-frame-v2',
    symbol: 'XAUUSDm',
  }
}

function emptyRealtimeFrame(): KLineChartRealtimeFrame {
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: [],
      dataIndexToGlobalIndex: [],
      dataIndexToTimestamp: [],
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map(),
    },
    key: 'realtime-frame',
    mainRows: [],
    panes: {},
    period: 'M5',
    sessionTimeFrom: 200_000,
    sessionTimeTo: null,
    source: 'realtime-page-kline-chart-frame-v2',
    symbol: 'XAUUSDm',
  }
}

function realtimeFrameWithRows(): KLineChartRealtimeFrame {
  return {
    ...emptyRealtimeFrame(),
    alignment: {
      barKeyToDataIndex: new Map([['realtime:1', 0], ['realtime:2', 1]]),
      dataIndexToBarKey: ['realtime:1', 'realtime:2'],
      dataIndexToGlobalIndex: [null, null],
      dataIndexToTimestamp: [100_000, 400_000],
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map([[100_000, 0], [400_000, 1]]),
    },
    mainRows: [
      { close: 9, high: 9, low: 9, open: 9, timestamp: 100_000, volume: 90 },
      { close: 4, high: 5, low: 3, open: 4, timestamp: 400_000, volume: 40 },
    ],
  }
}

describe('buildKLineChartRenderFrameV2', () => {
  it('combines history and empty realtime segments without adding fake rows', () => {
    const frame = buildKLineChartRenderFrameV2(historyFrame(), emptyRealtimeFrame())

    expect(frame.source).toBe('kline-chart-render-frame-v2')
    expect(frame.mainRows).toHaveLength(1)
    expect(frame.segments.history.rows).toBe(1)
    expect(frame.segments.realtime?.rows).toBe(0)
    expect(frame.segments.realtime?.timeFrom).toBe(200_000)
    expect(frame.alignment.dataIndexToBarKey).toEqual(['history:1'])
  })

  it('builds one unified render window and derives realtime segment indices from merged rows', () => {
    const frame = buildKLineChartRenderFrameV2(historyFrame(), realtimeFrameWithRows())

    expect(frame.mainRows).toHaveLength(2)
    expect(frame.mainRows.map((row) => row.timestamp)).toEqual([100_000, 400_000])
    expect(frame.mainRows[0].close).toBe(9)
    expect(frame.segments.history).toEqual(expect.objectContaining({
      fromIndex: frame.mainRows.length,
      rows: 0,
      toIndex: frame.mainRows.length - 1,
    }))
    expect(frame.segments.realtime).toEqual(expect.objectContaining({
      fromIndex: 0,
      rows: 2,
      toIndex: 1,
    }))
    expect(frame.alignment.dataIndexToBarKey).toEqual(['realtime:1', 'realtime:2'])
  })
})
