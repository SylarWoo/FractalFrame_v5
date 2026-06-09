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
        rightTimestamp: 3000,
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

  it('uses the saved timestamp when a realtime page was dragged away from the latest bar', () => {
    const storage = new Map<string, string>()
    storage.set(
      'fractalframe:klinechart-v2:viewport:XAUUSDM:M5:page:1:visual-realtime',
      JSON.stringify({
        barSpace: 8,
        dataLength: 3,
        offsetRightDistance: 0,
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

    expect(restoreKLineChartViewportStateV2(chart as never, 'XAUUSDm', 'M5', {
      allowOffsetRightDistance: true,
      viewportScope: 'page:1:visual-realtime',
    })).toBe(true)

    expect(chart.setBarSpace).toHaveBeenCalledWith(8)
    expect(chart.setOffsetRightDistance).not.toHaveBeenCalled()
    expect(chart.scrollToTimestamp).toHaveBeenCalledWith(2000, 0)
  })

  it('ignores saved right blank space when restoring a bounded history page', () => {
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

    expect(restoreKLineChartViewportStateV2(chart as never, 'XAUUSDm', 'M5', {
      allowOffsetRightDistance: false,
    })).toBe(true)

    expect(chart.setBarSpace).toHaveBeenCalledWith(8)
    expect(chart.setOffsetRightDistance).not.toHaveBeenCalled()
    expect(chart.scrollToTimestamp).toHaveBeenCalledWith(2000, 0)
  })

  it('restores a scoped history page viewport without using the default realtime viewport', () => {
    const storage = new Map<string, string>()
    storage.set(
      'fractalframe:klinechart-v2:viewport:XAUUSDM:M5',
      JSON.stringify({
        barSpace: 4,
        dataLength: 3,
        offsetRightDistance: 500,
        rightTimestamp: 999000,
        savedAt: '2026-06-08T00:00:00.000Z',
        visibleTo: 999,
      }),
    )
    storage.set(
      'fractalframe:klinechart-v2:viewport:XAUUSDM:M5:page:3:history',
      JSON.stringify({
        barSpace: 9,
        dataLength: 3,
        offsetRightDistance: null,
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

    expect(restoreKLineChartViewportStateV2(chart as never, 'XAUUSDm', 'M5', {
      allowOffsetRightDistance: false,
      viewportScope: 'page:3:history',
    })).toBe(true)

    expect(chart.setBarSpace).toHaveBeenCalledWith(9)
    expect(chart.setOffsetRightDistance).not.toHaveBeenCalled()
    expect(chart.scrollToTimestamp).toHaveBeenCalledWith(2000, 0)
  })
})
