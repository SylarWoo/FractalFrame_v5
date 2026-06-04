import { describe, expect, it } from 'vitest'
import { calculateTradingViewVmiRows, calculateVmiRowsForKLineChart } from './tradingViewVmiIndicator'
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

describe('calculateTradingViewVmiRows', () => {
  it('calculates VMI from its own VDO source calculation', () => {
    const rows = calculateTradingViewVmiRows(m5CloseData([1, 2, 3, 2, 4, 3]), {
      fastLength: 2,
      slowLength: 3,
    })

    expect(rows).toHaveLength(6)
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
    const settingsHash = createIndicatorSettingsHash({ indicator: 'VMI', period: 'M5', settings: { fastLength: 2 }, symbol: 'XAUUSDm' })
    writePageIndicatorRuntimeSnapshot({
      context,
      createSnapshotRows: () => ({ vmiRows: [{ histogram: 1 }, { histogram: 2 }, { histogram: 3 }] }),
      settingsHash,
      settingsHashKey: 'VMI',
    })

    const rows = calculateVmiRowsForKLineChart(dataList, {
      pageKey: context.pageKey,
      period: 'M5',
      runtimeOnly: true,
      settings: { fastLength: 2 },
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(rows[1]).toEqual({ histogram: 2 })
    expect(rows[2]).toEqual({ histogram: 3 })
  })

  it('returns empty rows instead of recalculating when runtimeOnly cache is missing', () => {
    const rows = calculateVmiRowsForKLineChart(m5CloseData([1, 2, 3, 4]), {
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settings: { fastLength: 1, slowLength: 1 },
      settingsHash: 'missing-settings',
      symbol: 'XAUUSDm',
    })

    expect(rows).toEqual([{}, {}, {}, {}])
  })
})
