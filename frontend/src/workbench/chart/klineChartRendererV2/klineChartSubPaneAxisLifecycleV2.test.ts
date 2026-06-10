import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  captureKLineChartSubPaneYAxisStateV2,
  installKLineChartSubPaneAxisLifecycleV2,
  readKLineChartSubPaneYAxisSnapshotV2,
  resolveKLineChartSubPaneAxisPaneIdsV2,
  restoreKLineChartSubPaneYAxisV2,
  writeKLineChartSubPaneYAxisSnapshotV2,
} from './klineChartSubPaneAxisLifecycleV2'

const manualRange = {
  from: 10,
  range: 40,
  realFrom: -20,
  realRange: 80,
  realTo: 60,
  to: 50,
}

function frameWithPanes(): KLineChartRenderFrameV2 {
  return ({
    key: 'frame-1',
    mainRows: [],
    pageIndex: 1,
    panes: {
      TSI: {
        key: 'tsi',
        paneId: 'tsi_pane',
        paneRole: 'indicator',
        renderRole: 'sub-pane',
        rows: [],
        source: 'test',
      },
      VDO: {
        key: 'vdo',
        paneId: 'vdo_pane',
        paneRole: 'indicator',
        renderRole: 'sub-pane',
        rows: [],
        source: 'test',
      },
      MA: {
        key: 'ma',
        paneId: 'main-ma-overlay',
        paneRole: 'main',
        renderRole: 'main-overlay',
        rows: [],
        source: 'test',
      },
    },
    period: 'M30',
    segments: {},
    symbol: 'XAUUSDm',
  } as unknown) as KLineChartRenderFrameV2
}

describe('klineChartSubPaneAxisLifecycleV2', () => {
  let localStorageData: Map<string, string>

  beforeEach(() => {
    localStorageData = new Map()
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      cancelAnimationFrame: vi.fn(),
      clearTimeout,
      dispatchEvent: vi.fn(),
      localStorage: {
        clear: vi.fn(() => localStorageData.clear()),
        getItem: vi.fn((key: string) => localStorageData.get(key) ?? null),
        removeItem: vi.fn((key: string) => localStorageData.delete(key)),
        setItem: vi.fn((key: string, value: string) => {
          localStorageData.set(key, value)
        }),
      },
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      }),
      setTimeout,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resolves only configured sub-pane y-axis pane ids from the render frame', () => {
    expect(resolveKLineChartSubPaneAxisPaneIdsV2(frameWithPanes())).toEqual(['tsi_pane', 'vdo_pane'])
  })

  it('restores a saved manual range for a sub-pane y-axis', () => {
    writeKLineChartSubPaneYAxisSnapshotV2('XAUUSDm', 'M30', 'tsi_pane', {
      mode: 'manual',
      paneId: 'tsi_pane',
      range: manualRange,
      savedAt: '2026-06-10T00:00:00.000Z',
    })
    const tsiAxis = {
      setAutoCalcTickFlag: vi.fn(),
      setRange: vi.fn(),
    }
    const chart = {
      adjustPaneViewport: vi.fn(),
      getDrawPaneById: vi.fn(() => ({
        getAxisComponent: () => tsiAxis,
      })),
    }

    restoreKLineChartSubPaneYAxisV2(chart as never, 'XAUUSDm', 'M30', ['tsi_pane'])

    expect(tsiAxis.setAutoCalcTickFlag).toHaveBeenCalledWith(false)
    expect(tsiAxis.setRange).toHaveBeenCalledWith(manualRange)
    expect(chart.adjustPaneViewport).toHaveBeenCalledWith(false, true, true, true, true)
  })

  it('falls back to auto scale when no sub-pane snapshot exists', () => {
    const tsiAxis = {
      setAutoCalcTickFlag: vi.fn(),
      setRange: vi.fn(),
    }
    const chart = {
      adjustPaneViewport: vi.fn(),
      getDrawPaneById: vi.fn(() => ({
        getAxisComponent: () => tsiAxis,
      })),
    }

    restoreKLineChartSubPaneYAxisV2(chart as never, 'NO_SNAPSHOT_SYMBOL', 'M30', ['tsi_pane'])

    expect(tsiAxis.setAutoCalcTickFlag).toHaveBeenCalledWith(true)
    expect(tsiAxis.setRange).not.toHaveBeenCalled()
  })

  it('captures manual sub-pane range to storage', () => {
    const chart = {
      getDrawPaneById: vi.fn(() => ({
        getAxisComponent: () => ({
          getAutoCalcTickFlag: () => false,
          getRange: () => manualRange,
        }),
      })),
    }

    captureKLineChartSubPaneYAxisStateV2(chart as never, 'XAUUSDm', 'M30', 'tsi_pane')

    expect(readKLineChartSubPaneYAxisSnapshotV2('XAUUSDm', 'M30', 'tsi_pane')).toMatchObject({
      mode: 'manual',
      paneId: 'tsi_pane',
      range: manualRange,
    })
  })

  it('does not keep restoring the same sub-pane axes on every realtime frame update', () => {
    const callbacks = new Map<number, FrameRequestCallback>()
    let nextFrameId = 1
    vi.mocked(window.requestAnimationFrame).mockImplementation((callback: FrameRequestCallback) => {
      const id = nextFrameId
      nextFrameId += 1
      callbacks.set(id, callback)
      return id
    })
    vi.mocked(window.cancelAnimationFrame).mockImplementation((id: number) => {
      callbacks.delete(id)
    })
    const root = {
      addEventListener: vi.fn(),
      ownerDocument: {
        documentElement: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      },
      removeEventListener: vi.fn(),
    }
    const tsiAxis = { setAutoCalcTickFlag: vi.fn() }
    const chart = {
      adjustPaneViewport: vi.fn(),
      getDom: vi.fn(() => root),
      getDrawPaneById: vi.fn(() => ({
        getAxisComponent: () => tsiAxis,
      })),
    }
    const lifecycle = installKLineChartSubPaneAxisLifecycleV2(chart as never, frameWithPanes())
    callbacks.forEach((callback) => callback(0))
    callbacks.clear()
    const initialCalls = tsiAxis.setAutoCalcTickFlag.mock.calls.length

    lifecycle.updateFrame({
      ...frameWithPanes(),
      key: 'frame-2',
    })
    callbacks.forEach((callback) => callback(16))

    expect(tsiAxis.setAutoCalcTickFlag).toHaveBeenCalledTimes(initialCalls)
    lifecycle.destroy()
  })
})
