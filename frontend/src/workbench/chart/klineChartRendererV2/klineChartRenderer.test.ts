import { describe, expect, it, vi } from 'vitest'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { applyKLineChartFrameTailUpdate, applyKLineChartFrameToChart } from './klineChartRenderer'

function frameData(): KLineChartRenderFrameV2 {
  return {
    alignment: {
      barKeyToDataIndex: new Map([['XAUUSDm|M5|100', 0]]),
      dataIndexToBarKey: ['XAUUSDm|M5|100'],
      dataIndexToGlobalIndex: [1],
      dataIndexToTimestamp: [100_000],
      globalIndexToDataIndex: new Map([[1, 0]]),
      timestampToDataIndex: new Map([[100_000, 0]]),
    },
    key: 'kline-chart-frame-v2:history-window-v2:XAUUSDm|M5|1|time|100|100',
    mainRows: [
      {
        close: 2,
        high: 3,
        low: 1,
        open: 1.5,
        timestamp: 100_000,
        volume: 10,
      },
    ],
    pageIndex: 1,
    panes: {},
    period: 'M5',
    segments: {
      history: {
        fromIndex: 0,
        key: 'kline-chart-frame-v2:history-window-v2:XAUUSDm|M5|1|time|100|100',
        rows: 1,
        source: 'history',
        timeFrom: 100_000,
        timeTo: 100_000,
        toIndex: 0,
      },
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

describe('applyKLineChartFrameToChart', () => {
  it('applies translated main rows to KLineCharts', () => {
    const chart = {
      applyNewData: vi.fn(),
    }
    const frame = frameData()

    const result = applyKLineChartFrameToChart(chart as never, frame)

    expect(chart.applyNewData).toHaveBeenCalledWith(frame.mainRows, false)
    expect(result).toEqual({
      key: frame.key,
      pageIndex: 1,
      period: 'M5',
      rows: 1,
      source: 'kline-chart-renderer-v2',
      symbol: 'XAUUSDm',
    })
  })

  it('can anchor the viewport at the realtime boundary after applying merged rows', () => {
    const chart = {
      applyNewData: vi.fn((_rows, _more, callback) => callback?.()),
      getVisibleRange: vi.fn(() => ({ from: 0, to: 40 })),
      scrollToDataIndex: vi.fn(),
    }
    const frame = {
      ...frameData(),
      mainRows: Array.from({ length: 80 }, (_, index) => ({
        close: index,
        high: index,
        low: index,
        open: index,
        timestamp: 100_000 + index * 60_000,
        volume: 1,
      })),
      segments: {
        history: {
          ...frameData().segments.history,
          rows: 60,
          toIndex: 59,
        },
        realtime: {
          fromIndex: 60,
          key: 'realtime-frame',
          rows: 20,
          source: 'realtime' as const,
          timeFrom: 3_700_000,
          timeTo: 4_900_000,
          toIndex: 79,
        },
      },
    }

    applyKLineChartFrameToChart(chart as never, frame, undefined, { anchorRealtimeBoundary: true })

    expect(chart.scrollToDataIndex).toHaveBeenCalledWith(79, 0)
  })

  it('preserves the visible range when applying updates inside the same render window', () => {
    const chart = {
      applyNewData: vi.fn((_rows, _more, callback) => callback?.()),
      getVisibleRange: vi.fn(() => ({ from: 20, to: 60 })),
      scrollToDataIndex: vi.fn(),
    }
    const frame = frameData()

    applyKLineChartFrameToChart(chart as never, frame, undefined, { preserveVisibleRange: true })

    expect(chart.scrollToDataIndex).toHaveBeenCalledWith(60, 0)
  })

  it('runs viewport restore through the applyNewData ready callback', () => {
    const restoreViewport = vi.fn(() => true)
    const chart = {
      applyNewData: vi.fn((_rows, _more, callback) => callback?.()),
    }
    const frame = frameData()

    applyKLineChartFrameToChart(chart as never, frame, undefined, { restoreViewport })

    expect(restoreViewport).toHaveBeenCalledTimes(1)
  })

  it('updates only the latest kline for tail updates', () => {
    const chart = {
      updateData: vi.fn(),
    }
    const frame = frameData()

    applyKLineChartFrameTailUpdate(chart as never, frame)

    expect(chart.updateData).toHaveBeenCalledWith(frame.mainRows[frame.mainRows.length - 1])
  })
})
