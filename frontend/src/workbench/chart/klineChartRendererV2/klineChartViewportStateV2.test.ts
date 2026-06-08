import { afterEach, describe, expect, it, vi } from 'vitest'
import { restoreKLineChartViewportStateV2 } from './klineChartViewportStateV2'

describe('restoreKLineChartViewportStateV2', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('restores offsetRightDistance before timestamp so right blank space survives refresh', () => {
    const storage = new Map<string, string>()
    storage.set(
      'fractalframe:klinechart-v2:viewport:XAUUSDM:M5',
      JSON.stringify({
        barSpace: 8,
        dataLength: 3,
        offsetRightDistance: 120,
        rightTimestamp: 2000,
        savedAt: '2026-06-08T00:00:00.000Z',
        visibleTo: 2,
      }),
    )
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
      },
    })
    const chart = {
      getDataList: vi.fn(() => [{ timestamp: 1000 }, { timestamp: 2000 }, { timestamp: 3000 }]),
      setBarSpace: vi.fn(),
      setOffsetRightDistance: vi.fn(),
      scrollToTimestamp: vi.fn(),
    }

    expect(restoreKLineChartViewportStateV2(chart as never, 'XAUUSDm', 'M5')).toBe(true)

    expect(chart.setBarSpace).toHaveBeenCalledWith(8)
    expect(chart.setOffsetRightDistance).toHaveBeenCalledWith(120)
    expect(chart.scrollToTimestamp).not.toHaveBeenCalled()
  })
})
