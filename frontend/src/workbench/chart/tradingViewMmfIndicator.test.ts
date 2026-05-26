import { describe, expect, it, vi } from 'vitest'
import type { KLineData } from 'klinecharts'
import { defaultMmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'

function createRow(index: number, close: number): KLineData {
  return {
    close,
    high: close + 0.5,
    low: close - 0.5,
    open: close,
    timestamp: 1_700_000_000_000 + index * 5 * 60 * 1000,
    volume: 1,
  }
}

function installMocks(dpo: number[], k: number[], d: number[]) {
  vi.doMock('./tradingViewDpoIndicator', () => ({
    calculateTradingViewDpoRows: () => dpo.map((value) => ({ dpo: value })),
  }))
  vi.doMock('./tradingViewStochIndicator', () => ({
    calculateTradingViewStochRows: () => k.map((value, index) => ({ k: value, d: d[index] })),
  }))
  vi.doMock('./morganRangeModel', () => ({
    calculateMorganRangeSegments: () => [],
    getMorganRangeLevel: () => null,
  }))
}

function cleanupMocks() {
  vi.doUnmock('./tradingViewDpoIndicator')
  vi.doUnmock('./tradingViewStochIndicator')
  vi.doUnmock('./morganRangeModel')
}

describe('tradingViewMmfIndicator', () => {
  it('marks the highest high inside a stochastic high cycle when DPO filters the cycle', async () => {
    vi.resetModules()
    installMocks(
      [0, 0, 8, 12, 13, 12, 9, 6, 4],
      [42, 48, 55, 72, 86, 76, 68, 66, 64],
      [44, 49, 52, 70, 82, 78, 69, 66, 64],
    )

    const { calculateTradingViewMmfRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 102, 108, 104, 112, 109, 106, 103, 101].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(data, {
      ...defaultMmfIndicatorSettings,
      dpoValue: 11,
      showHigh: true,
    })

    expect(rows[4]?.highMarker).toBe(112.5)
    expect(rows.filter((row) => Number.isFinite(row.highMarker))).toHaveLength(1)
    cleanupMocks()
  })

  it('does not mark a high cycle without Morgan or DPO filter match', async () => {
    vi.resetModules()
    installMocks(
      [0, 0, 8, 9, 10, 9, 8, 6],
      [42, 48, 55, 72, 86, 76, 68, 66],
      [44, 49, 52, 70, 82, 78, 69, 66],
    )

    const { calculateTradingViewMmfRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 102, 108, 104, 112, 109, 106, 103].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(data, {
      ...defaultMmfIndicatorSettings,
      dpoValue: 11,
      showHigh: true,
    })

    expect(rows.some((row) => Number.isFinite(row.highMarker))).toBe(false)
    cleanupMocks()
  })

  it('does not mark a high cycle when the stochastic top stays inside 70', async () => {
    vi.resetModules()
    installMocks(
      [0, 0, 8, 12, 13, 12, 9, 6],
      [42, 48, 55, 66, 69, 64, 60, 58],
      [44, 49, 52, 65, 67, 66, 61, 58],
    )

    const { calculateTradingViewMmfRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 102, 108, 104, 112, 109, 106, 103].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(data, {
      ...defaultMmfIndicatorSettings,
      dpoValue: 11,
      showHigh: true,
    })

    expect(rows.some((row) => Number.isFinite(row.highMarker))).toBe(false)
    cleanupMocks()
  })

  it('does not start a high cycle from stochastic values already above 50', async () => {
    vi.resetModules()
    installMocks(
      [12, 13, 14, 9],
      [86, 81, 76, 68],
      [82, 83, 77, 69],
    )

    const { calculateTradingViewMmfRows } = await import('./tradingViewMmfIndicator')
    const data = [100, 105, 107, 103].map((close, index) => createRow(index, close))
    const rows = calculateTradingViewMmfRows(data, {
      ...defaultMmfIndicatorSettings,
      dpoValue: 11,
      showHigh: true,
    })

    expect(rows.some((row) => Number.isFinite(row.highMarker))).toBe(false)
    cleanupMocks()
  })
})
