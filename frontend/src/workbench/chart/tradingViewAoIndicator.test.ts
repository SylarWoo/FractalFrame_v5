import { describe, expect, it } from 'vitest'
import { calculateAoRowsForKLineChart, calculateTradingViewAoRows } from './tradingViewAoIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

const m5CloseData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close + 1,
  low: close - 1,
  open: close,
  timestamp: index * 300_000,
  volume: 1,
}))

describe('calculateTradingViewAoRows', () => {
  it('returns one row per source bar', () => {
    const rows = calculateTradingViewAoRows(m5CloseData([1, 2, 3, 4]), { fastLength: 2, slowLength: 3 })

    expect(rows).toHaveLength(4)
  })

  it('reads page runtime cache instead of recalculating when runtimeOnly is enabled', () => {
    const dataList = m5CloseData([1, 2, 3])
    const context = createPageIndicatorRuntimeContext({
      mode: 'realtime',
      pageIndex: 1,
      period: 'M5',
      rows: dataList,
      symbol: 'XAUUSDm',
    })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'AO', period: 'M5', settings: { fastLength: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ aoRows: [{ histogram: 1 }, { histogram: 2 }, { histogram: 3 }] }),
      settingsHash,
      settingsHashKey: 'AO',
    })

    const rows = calculateAoRowsForKLineChart(dataList, {
      fastLength: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ histogram: 2 })
    expect(rows[2]).toEqual({ histogram: 3 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateAoRowsForKLineChart(m5CloseData([1, 2, 3, 4]), {
      fastLength: 1,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-settings',
      slowLength: 1,
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}])
  })
})
