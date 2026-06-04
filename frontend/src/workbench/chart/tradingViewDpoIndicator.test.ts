import { describe, expect, it } from 'vitest'
import { calculateDpoRowsForKLineChart, calculateTradingViewDpoRows } from './tradingViewDpoIndicator'
import { createIndicatorSettingsHash } from './indicatorPageSnapshotStore'
import {
  createPageIndicatorRuntimeContext,
  writePageIndicatorRuntimeSnapshot,
} from './pageIndicatorRuntime'

const m5CloseData = (values: number[]) => values.map((close, index) => ({
  close,
  high: close,
  low: close,
  open: close,
  timestamp: index * 300_000,
  volume: 1,
}))

describe('calculateTradingViewDpoRows', () => {
  it('returns one row per source bar', () => {
    const rows = calculateTradingViewDpoRows(m5CloseData([1, 2, 3, 4]), { length: 2 })

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
    const settingsHash = createIndicatorSettingsHash({ indicator: 'DPO', period: 'M5', settings: { length: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ dpoRows: [{ dpo: 1 }, { dpo: 2 }, { dpo: 3 }] }),
      settingsHash,
      settingsHashKey: 'DPO',
    })

    const rows = calculateDpoRowsForKLineChart(dataList, {
      length: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ dpo: 2 })
    expect(rows[2]).toEqual({ dpo: 3 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateDpoRowsForKLineChart(m5CloseData([1, 2, 3, 4]), {
      length: 1,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-settings',
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}])
  })
})
