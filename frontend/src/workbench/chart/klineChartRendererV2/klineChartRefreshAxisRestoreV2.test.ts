import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreKLineChartSubPaneYAxisV2, writeKLineChartSubPaneYAxisSnapshotV2 } from './klineChartSubPaneAxisLifecycleV2'
import { restoreKLineChartYAxisAfterDataReadyV2, writeKLineChartYAxisSnapshotV2 } from './klineChartYAxisRestoreV2'

const mainRange = {
  from: 4300,
  range: 200,
  realFrom: 4300,
  realRange: 200,
  realTo: 4500,
  to: 4500,
}

const tsiRange = {
  from: -60,
  range: 120,
  realFrom: -60,
  realRange: 120,
  realTo: 60,
  to: 60,
}

const vdoRange = {
  from: -0.2,
  range: 0.4,
  realFrom: -0.2,
  realRange: 0.4,
  realTo: 0.2,
  to: 0.2,
}

describe('klineChartRefreshAxisRestoreV2', () => {
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value)
        }),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores main and sub-pane y axes from independent refresh snapshots', () => {
    writeKLineChartYAxisSnapshotV2('XAUUSDm', 'M30', {
      mode: 'manual',
      range: mainRange,
      savedAt: '2026-06-10T00:00:00.000Z',
    })
    writeKLineChartSubPaneYAxisSnapshotV2('XAUUSDm', 'M30', 'tsi_pane', {
      mode: 'manual',
      paneId: 'tsi_pane',
      range: tsiRange,
      savedAt: '2026-06-10T00:00:00.000Z',
    })
    writeKLineChartSubPaneYAxisSnapshotV2('XAUUSDm', 'M30', 'vdo_pane', {
      mode: 'manual',
      paneId: 'vdo_pane',
      range: vdoRange,
      savedAt: '2026-06-10T00:00:00.000Z',
    })
    const axes = {
      candle_pane: { setAutoCalcTickFlag: vi.fn(), setRange: vi.fn() },
      tsi_pane: { setAutoCalcTickFlag: vi.fn(), setRange: vi.fn() },
      vdo_pane: { setAutoCalcTickFlag: vi.fn(), setRange: vi.fn() },
    }
    const chart = {
      adjustPaneViewport: vi.fn(),
      getDrawPaneById: vi.fn((paneId: keyof typeof axes) => ({
        getAxisComponent: () => axes[paneId],
      })),
    }

    expect(restoreKLineChartYAxisAfterDataReadyV2(chart as never, 'XAUUSDm', 'M30')).toBe(true)
    restoreKLineChartSubPaneYAxisV2(chart as never, 'XAUUSDm', 'M30', ['tsi_pane', 'vdo_pane'])

    expect(axes.candle_pane.setAutoCalcTickFlag).toHaveBeenCalledWith(false)
    expect(axes.candle_pane.setRange).toHaveBeenCalledWith(mainRange)
    expect(axes.tsi_pane.setAutoCalcTickFlag).toHaveBeenCalledWith(false)
    expect(axes.tsi_pane.setRange).toHaveBeenCalledWith(tsiRange)
    expect(axes.vdo_pane.setAutoCalcTickFlag).toHaveBeenCalledWith(false)
    expect(axes.vdo_pane.setRange).toHaveBeenCalledWith(vdoRange)
  })

  it('keeps axis snapshots isolated between periods on refresh', () => {
    writeKLineChartYAxisSnapshotV2('XAUUSDm', 'M5', {
      mode: 'manual',
      range: mainRange,
      savedAt: '2026-06-10T00:00:00.000Z',
    })
    const yAxis = {
      setAutoCalcTickFlag: vi.fn(),
      setRange: vi.fn(),
    }
    const chart = {
      adjustPaneViewport: vi.fn(),
      getDrawPaneById: vi.fn(() => ({
        getAxisComponent: () => yAxis,
      })),
    }

    expect(restoreKLineChartYAxisAfterDataReadyV2(chart as never, 'XAUUSDm', 'M30')).toBe(false)

    expect(yAxis.setAutoCalcTickFlag).toHaveBeenCalledWith(true)
    expect(yAxis.setRange).not.toHaveBeenCalled()
  })
})
