import { describe, expect, it } from 'vitest'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { markMainMaRowsBreakBeforeRealtimeGapV2 } from './klineChartMainMaOverlayV2'

function frameWithGap(gapMs: number): KLineChartRenderFrameV2 {
  const first = 1_700_000_000_000
  const second = first + gapMs
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: ['history', 'realtime'],
      dataIndexToGlobalIndex: [1, null],
      dataIndexToTimestamp: [first, second],
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map(),
    },
    key: `frame:${gapMs}`,
    mainRows: [
      { close: 1, high: 1, low: 1, open: 1, timestamp: first, volume: 1 },
      { close: 2, high: 2, low: 2, open: 2, timestamp: second, volume: 1 },
    ],
    pageIndex: 2,
    panes: {},
    period: 'M5',
    segments: {
      history: {
        fromIndex: 0,
        key: 'history',
        rows: 1,
        source: 'history',
        timeFrom: first,
        timeTo: first,
        toIndex: 0,
      },
      realtime: {
        fromIndex: 1,
        key: 'realtime',
        rows: 1,
        source: 'realtime',
        timeFrom: second,
        timeTo: second,
        toIndex: 1,
      },
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

const pane: KLineChartPaneFrame = {
  key: 'MA',
  paneId: 'main-ma-overlay',
  paneRole: 'main',
  renderRole: 'main-overlay',
  rows: [{ ma: 1 }, { ma: 2 }],
  source: 'kline-chart-render-pane-frame-v2',
}

describe('markMainMaRowsBreakBeforeRealtimeGapV2', () => {
  it('marks the first realtime MA row when history and realtime are far apart', () => {
    const rows = markMainMaRowsBreakBeforeRealtimeGapV2(frameWithGap(10 * 24 * 60 * 60 * 1000), pane)

    expect(rows[0]).toEqual({ ma: 1 })
    expect(rows[1]).toEqual({ ma: 2, breakBefore: true })
  })

  it('keeps the line continuous for a short same-session maintenance gap', () => {
    const rows = markMainMaRowsBreakBeforeRealtimeGapV2(frameWithGap(65 * 60 * 1000), pane)

    expect(rows[1]).toEqual({ ma: 2 })
  })
})
