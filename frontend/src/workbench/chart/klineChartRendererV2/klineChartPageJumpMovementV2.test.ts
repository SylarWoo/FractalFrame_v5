import { describe, expect, it, vi } from 'vitest'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  applyKLineChartPageJumpMovementV2,
  resolveKLineChartPageJumpMovementV2,
} from './klineChartPageJumpMovementV2'

function frame(pageIndex: number, rows = 100, realtime = false): KLineChartRenderFrameV2 {
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: [],
      dataIndexToGlobalIndex: [],
      dataIndexToTimestamp: [],
      globalIndexToDataIndex: new Map(),
      timestampToDataIndex: new Map(),
    },
    key: `frame-${pageIndex}`,
    mainRows: Array.from({ length: rows }, (_, index) => ({
      close: index,
      high: index,
      low: index,
      open: index,
      timestamp: index,
    })),
    pageIndex,
    panes: {},
    period: 'M5',
    segments: {
      history: {
        fromIndex: 0,
        key: `history-${pageIndex}`,
        rows: realtime ? rows - 10 : rows,
        source: 'history',
        timeFrom: 0,
        timeTo: rows - 11,
        toIndex: realtime ? rows - 11 : rows - 1,
      },
      ...(realtime ? {
        realtime: {
          fromIndex: rows - 10,
          key: `realtime-${pageIndex}`,
          rows: 10,
          source: 'realtime' as const,
          timeFrom: rows - 10,
          timeTo: rows - 1,
          toIndex: rows - 1,
        },
      } : {}),
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

describe('klineChartPageJumpMovementV2', () => {
  it('does not treat initial refresh restore as a page jump', () => {
    expect(resolveKLineChartPageJumpMovementV2(null, frame(1, 100, true))).toBeNull()
  })

  it('does not treat a same-page realtime update as a page jump', () => {
    expect(resolveKLineChartPageJumpMovementV2(frame(1, 100, true), frame(1, 101, true))).toBeNull()
  })

  it('moves from page 2 to page 3 by showing the new history tail', () => {
    const current = frame(3, 80)
    const movement = resolveKLineChartPageJumpMovementV2(frame(2), current)
    const chart = {
      getVisibleRange: vi.fn(() => ({ from: 20, to: 60 })),
      scrollToDataIndex: vi.fn(),
    }

    expect(movement).toBe('history-tail')
    expect(applyKLineChartPageJumpMovementV2(chart as never, current, movement)).toBe(true)
    expect(chart.scrollToDataIndex).toHaveBeenCalledWith(79, 0)
  })

  it('moves from page 4 to page 3 by showing the new history head', () => {
    const current = frame(3, 80)
    const movement = resolveKLineChartPageJumpMovementV2(frame(4), current)
    const chart = {
      getVisibleRange: vi.fn(() => ({ from: 20, to: 60 })),
      scrollToDataIndex: vi.fn(),
    }

    expect(movement).toBe('history-head')
    expect(applyKLineChartPageJumpMovementV2(chart as never, current, movement)).toBe(true)
    expect(chart.scrollToDataIndex).toHaveBeenCalledWith(40, 0)
  })

  it('jumps from a distant history page to page 1 by showing the realtime latest bar', () => {
    const current = frame(1, 100, true)
    const movement = resolveKLineChartPageJumpMovementV2(frame(11), current)
    const chart = {
      getVisibleRange: vi.fn(() => ({ from: 20, to: 60 })),
      scrollToDataIndex: vi.fn(),
    }

    expect(movement).toBe('realtime-latest')
    expect(applyKLineChartPageJumpMovementV2(chart as never, current, movement)).toBe(true)
    expect(chart.scrollToDataIndex).toHaveBeenCalledWith(99, 0)
  })
})
