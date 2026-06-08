import { describe, expect, it } from 'vitest'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  buildKLineChartRenderWindowKeyV2,
  canApplyKLineChartPaneOnlyUpdateV2,
  canApplyKLineChartTailUpdateV2,
} from './klineChartFrameLifecycleV2'

function frame(rows: number, realtimeTimeFrom: number | null = 1000): KLineChartRenderFrameV2 {
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: [],
      dataIndexToGlobalIndex: [],
      dataIndexToTimestamp: [],
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map(),
    },
    key: `frame-${rows}-${realtimeTimeFrom ?? 'none'}`,
    mainRows: Array.from({ length: rows }, (_, index) => ({
      close: index,
      high: index,
      low: index,
      open: index,
      timestamp: index,
    })),
    pageIndex: 1,
    panes: {},
    period: 'M5',
    segments: {
      history: {
        fromIndex: 0,
        key: 'history-page-1',
        rows: 2,
        source: 'history',
        timeFrom: 1,
        timeTo: 2,
        toIndex: 1,
      },
      realtime: realtimeTimeFrom == null ? undefined : {
        fromIndex: 2,
        key: 'realtime',
        rows: Math.max(0, rows - 2),
        source: 'realtime',
        timeFrom: realtimeTimeFrom,
        timeTo: realtimeTimeFrom,
        toIndex: rows - 1,
      },
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

describe('klineChartFrameLifecycleV2', () => {
  it('uses symbol period page history and realtime boundary as the render window key', () => {
    expect(buildKLineChartRenderWindowKeyV2(frame(3))).toBe('XAUUSDm:M5:1:history-page-1:1000')
  })

  it('ignores indicator key suffixes when resolving the main render window key', () => {
    const next = frame(3)
    next.segments.history.key = 'history-page-1:indicators:VOL:on:{"maChecked":true}'

    expect(buildKLineChartRenderWindowKeyV2(next)).toBe('XAUUSDm:M5:1:history-page-1:1000')
  })

  it('allows only same-window same-length or one-row tail updates', () => {
    const previous = frame(3)
    const appended = frame(4)
    expect(canApplyKLineChartTailUpdateV2({
      current: appended,
      previous,
      sameRenderWindow: true,
    })).toBe(true)
    expect(canApplyKLineChartTailUpdateV2({
      current: frame(5),
      previous: frame(3),
      sameRenderWindow: true,
    })).toBe(false)
    expect(canApplyKLineChartTailUpdateV2({
      current: frame(4),
      previous: frame(3),
      sameRenderWindow: false,
    })).toBe(false)
  })

  it('allows pane-only updates when kline rows are unchanged', () => {
    const previous = frame(3)
    const current = frame(3)
    current.key = 'frame-with-vol-settings'
    current.panes = {
      VOL: {
        key: 'VOL:1',
        renderRole: 'main-overlay',
        rows: [],
        settings: { maChecked: true },
        source: 'history-page-kline-chart-pane-frame-v2',
      },
    }

    expect(canApplyKLineChartPaneOnlyUpdateV2({
      current,
      previous,
      sameRenderWindow: true,
    })).toBe(true)

    current.mainRows[1] = { ...current.mainRows[1], close: 99 }
    expect(canApplyKLineChartPaneOnlyUpdateV2({
      current,
      previous,
      sameRenderWindow: true,
    })).toBe(false)
  })
})
