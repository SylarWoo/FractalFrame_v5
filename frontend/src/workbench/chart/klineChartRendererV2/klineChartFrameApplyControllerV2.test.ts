import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { applyKLineChartFrameUpdateV2 } from './klineChartFrameApplyControllerV2'
import { buildKLineChartRenderWindowKeyV2 } from './klineChartFrameLifecycleV2'

function frame(): KLineChartRenderFrameV2 {
  return {
    alignment: {
      barKeyToDataIndex: new Map(),
      dataIndexToBarKey: ['bar-1'],
      dataIndexToGlobalIndex: [1],
      dataIndexToTimestamp: [1000],
      globalIndexToDataIndex: new Map([[1, 0]]),
      timestampToDataIndex: new Map([[1000, 0]]),
    },
    key: 'frame-1',
    mainRows: [{
      close: 1,
      high: 1,
      low: 1,
      open: 1,
      timestamp: 1000,
      volume: 1,
    }],
    pageIndex: 1,
    panes: {},
    period: 'M5',
    segments: {
      history: {
        fromIndex: 0,
        key: 'history-1',
        rows: 1,
        source: 'history',
        timeFrom: 1000,
        timeTo: 1000,
        toIndex: 0,
      },
    },
    source: 'kline-chart-render-frame-v2',
    symbol: 'XAUUSDm',
  }
}

describe('applyKLineChartFrameUpdateV2', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates overlays once for a full frame apply', () => {
    vi.stubGlobal('window', {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })
    const nextFrame = frame()
    const chart = {
      applyNewData: vi.fn((_rows, _more, callback) => callback?.()),
    }
    const overlayController = {
      updateFrame: vi.fn(),
      updatePageNavigation: vi.fn(),
    }

    applyKLineChartFrameUpdateV2({
      appliedFrameKey: '',
      appliedRenderWindowKey: '',
      chart: chart as never,
      chartRoot: null,
      dragInProgress: false,
      displayController: { scheduleApply: vi.fn() },
      frame: nextFrame,
      onAppliedFrameKeyChange: vi.fn(),
      onAppliedRenderWindowKeyChange: vi.fn(),
      onPreviousFrameChange: vi.fn(),
      overlayController,
      previousFrame: null,
      renderStateController: {
        beginFrameRestore: vi.fn(() => ({
          anchorRealtimeBoundary: false,
          preserveVisibleRange: false,
          restoreViewport: () => true,
        })),
        handleDataReady: vi.fn(),
      },
    })

    expect(overlayController.updateFrame).toHaveBeenCalledTimes(1)
    expect(overlayController.updatePageNavigation).toHaveBeenCalledTimes(1)
  })

  it('defers tail updates while the chart is being dragged', () => {
    vi.stubGlobal('window', {})
    const previousFrame = frame()
    const nextFrame: KLineChartRenderFrameV2 = {
      ...previousFrame,
      key: 'frame-2',
      mainRows: [{
        ...previousFrame.mainRows[0],
        close: 2,
      }],
    }
    const chart = {
      getDataList: vi.fn(() => previousFrame.mainRows),
      updateData: vi.fn(),
    }
    const overlayController = {
      updateFrame: vi.fn(),
      updatePageNavigation: vi.fn(),
    }
    const onAppliedFrameKeyChange = vi.fn()

    applyKLineChartFrameUpdateV2({
      appliedFrameKey: previousFrame.key,
      appliedRenderWindowKey: buildKLineChartRenderWindowKeyV2(nextFrame),
      chart: chart as never,
      chartRoot: null,
      dragInProgress: true,
      displayController: { scheduleApply: vi.fn() },
      frame: nextFrame,
      onAppliedFrameKeyChange,
      onAppliedRenderWindowKeyChange: vi.fn(),
      onPreviousFrameChange: vi.fn(),
      overlayController,
      previousFrame,
      renderStateController: {
        beginFrameRestore: vi.fn(() => ({
          anchorRealtimeBoundary: false,
          preserveVisibleRange: false,
          restoreViewport: () => true,
        })),
        handleDataReady: vi.fn(),
      },
    })

    expect(chart.updateData).not.toHaveBeenCalled()
    expect(onAppliedFrameKeyChange).not.toHaveBeenCalled()
    expect(overlayController.updateFrame).not.toHaveBeenCalled()
    expect(overlayController.updatePageNavigation).not.toHaveBeenCalled()
  })
})
