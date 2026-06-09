import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  installKLineChartYAxisRestorePersistenceV2,
  isKLineChartYAxisRangeUsableV2,
  restoreKLineChartYAxisAfterDataReadyV2,
} from './klineChartYAxisRestoreV2'

const manualRange = {
  from: 100,
  range: 10,
  realFrom: 100,
  realRange: 10,
  realTo: 110,
  to: 110,
}

describe('klineChartYAxisRestoreV2', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps a finite manual y-axis range even when visible prices are outside it', () => {
    expect(isKLineChartYAxisRangeUsableV2(manualRange)).toBe(true)
  })

  it('restores the exact saved manual y-axis range for the current symbol and period', () => {
    const storage = new Map<string, string>()
    storage.set(
      'fractalframe:klinechart-v2:yAxisRestore:XAUUSDM:M5',
      JSON.stringify({
        mode: 'manual',
        range: manualRange,
        savedAt: '2026-06-09T00:00:00.000Z',
      }),
    )
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
      },
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

    expect(restoreKLineChartYAxisAfterDataReadyV2(chart as never, 'XAUUSDm', 'M5')).toBe(true)

    expect(yAxis.setAutoCalcTickFlag).toHaveBeenCalledWith(false)
    expect(yAxis.setRange).toHaveBeenCalledWith(manualRange)
    expect(chart.adjustPaneViewport).toHaveBeenCalledWith(false, true, true, true)
  })

  it('saves the current y-axis range when a chart drag ends', () => {
    vi.useFakeTimers()
    const storage = new Map<string, string>()
    const root = new EventTarget()
    vi.stubGlobal('window', Object.assign(new EventTarget(), {
      clearTimeout,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      setTimeout,
    }))
    const yAxis = {
      getAutoCalcTickFlag: vi.fn(() => false),
      getRange: vi.fn(() => manualRange),
    }
    const chart = {
      getDom: vi.fn(() => root),
      getDrawPaneById: vi.fn(() => ({
        getAxisComponent: () => yAxis,
      })),
    }
    const persistence = installKLineChartYAxisRestorePersistenceV2(chart as never, () => ({
      period: 'M5',
      symbol: 'XAUUSDm',
    }))

    root.dispatchEvent(new Event('mouseup'))
    vi.runOnlyPendingTimers()

    const saved = JSON.parse(storage.get('fractalframe:klinechart-v2:yAxisRestore:XAUUSDM:M5') ?? '{}')
    expect(saved.mode).toBe('manual')
    expect(saved.range).toEqual(manualRange)

    persistence.destroy()
    vi.useRealTimers()
  })
})
