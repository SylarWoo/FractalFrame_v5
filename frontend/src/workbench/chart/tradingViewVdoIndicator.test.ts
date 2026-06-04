import { describe, expect, it } from 'vitest'
import { calculateTradingViewVdoRows, calculateVdoRowsForKLineChart } from './tradingViewVdoIndicator'
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

describe('calculateTradingViewVdoRows', () => {
  it('returns one row per source bar', () => {
    const rows = calculateTradingViewVdoRows(m5CloseData([1, 2, 3, 4]), { length: 2 })

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
    const settingsHash = createIndicatorSettingsHash({ indicator: 'VDO', period: 'M5', settings: { length: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ vdoRows: [{ vdo: 1 }, { vdo: 2, vdoMa: 3 }, { vdo: 4, vdoMa2: 5 }] }),
      settingsHash,
      settingsHashKey: 'VDO',
    })

    const rows = calculateVdoRowsForKLineChart(dataList, {
      length: 2,
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ vdo: 2, vdoMa: 3 })
    expect(rows[2]).toEqual({ vdo: 4, vdoMa2: 5 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateVdoRowsForKLineChart(m5CloseData([1, 2, 3, 4]), {
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
