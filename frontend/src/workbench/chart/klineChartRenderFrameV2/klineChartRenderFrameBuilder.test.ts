import { describe, expect, it } from 'vitest'
import type { KLineChartHistoryFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRealtimeFrame } from '../klineChartRealtimeFrameV2'
import type { MorganRangeSegment } from '../morganRangeModel'
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

function mrSegment(startIndex: number, endIndex: number, startTimestamp: number): MorganRangeSegment {
  return {
    atr7: 2,
    center: 100,
    endIndex,
    index: 1,
    levels: [],
    lower: 94,
    range: 6,
    startIndex,
    startTimestamp,
    trueRange: 2.832,
    upper: 106,
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

  it('merges indicator pane rows on the same timestamp grid as main rows', () => {
    const history = {
      ...historyFrame(),
      panes: {
        MA: {
          key: 'history-ma',
          paneId: 'main-ma-overlay',
          paneRole: 'main' as const,
          renderRole: 'main-overlay' as const,
          rows: [{ ma: 1 }],
          settings: { length: 3 },
          source: 'history-page-kline-chart-pane-frame-v2' as const,
        },
      },
    }
    const realtime = {
      ...realtimeFrameWithRows(),
      panes: {
        MA: {
          key: 'realtime-ma',
          paneId: 'main-ma-overlay',
          paneRole: 'main' as const,
          renderRole: 'main-overlay' as const,
          rows: [{ ma: 9 }, { ma: 4 }],
          settings: { length: 3 },
          source: 'realtime-page-kline-chart-pane-frame-v2' as const,
        },
      },
    }

    const frame = buildKLineChartRenderFrameV2(history, realtime)

    expect(frame.mainRows.map((row) => row.timestamp)).toEqual([100_000, 400_000])
    expect(frame.panes.MA).toMatchObject({
      paneId: 'main-ma-overlay',
      paneRole: 'main',
      renderRole: 'main-overlay',
      source: 'kline-chart-render-pane-frame-v2',
    })
    expect(frame.panes.MA.rows).toEqual([{ ma: 9 }, { ma: 4 }])
  })

  it('translates Morgan Range segment indices into the unified render frame index space', () => {
    const history = {
      ...historyFrame(),
      panes: {
        MR_M5: {
          key: 'history-mr',
          paneId: 'main-morgan-range-m5-overlay',
          paneRole: 'main' as const,
          renderRole: 'main-overlay' as const,
          rows: [mrSegment(0, 1, 100_000)],
          source: 'history-page-kline-chart-pane-frame-v2' as const,
        },
      },
    }
    const realtime = {
      ...realtimeFrameWithRows(),
      alignment: {
        barKeyToDataIndex: new Map([['realtime:1', 0], ['realtime:2', 1]]),
        dataIndexToBarKey: ['realtime:1', 'realtime:2'],
        dataIndexToGlobalIndex: [null, null],
        dataIndexToTimestamp: [400_000, 700_000],
        globalIndexToDataIndex: new Map(),
        timestampToDataIndex: new Map([[400_000, 0], [700_000, 1]]),
      },
      mainRows: [
        { close: 4, high: 5, low: 3, open: 4, timestamp: 400_000, volume: 40 },
        { close: 7, high: 8, low: 6, open: 7, timestamp: 700_000, volume: 70 },
      ],
      panes: {
        MR_M5: {
          key: 'realtime-mr',
          paneId: 'main-morgan-range-m5-overlay',
          paneRole: 'main' as const,
          renderRole: 'main-overlay' as const,
          rows: [mrSegment(0, 2, 400_000)],
          source: 'realtime-page-kline-chart-pane-frame-v2' as const,
        },
      },
    }

    const frame = buildKLineChartRenderFrameV2(history, realtime)

    expect(frame.mainRows.map((row) => row.timestamp)).toEqual([100_000, 400_000, 700_000])
    expect(frame.panes.MR_M5.rows).toEqual([
      expect.objectContaining({ endIndex: 1, startIndex: 0, startTimestamp: 100_000 }),
      expect.objectContaining({ endIndex: 3, startIndex: 1, startTimestamp: 400_000 }),
    ])
  })
})
