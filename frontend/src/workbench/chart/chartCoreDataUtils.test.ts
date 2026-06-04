import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { historyPageSize, initialLoadLimit, maxInitialLoadLimit, mergeKLineData, resolveInitialLimit } from './chartCoreDataUtils'

describe('chartCoreDataUtils', () => {
  it('uses StoreV6 page sizes for chart windows', () => {
    expect(initialLoadLimit).toBe(2_000)
    expect(historyPageSize).toBe(2_500)
    expect(resolveInitialLimit()).toBe(2_000)
    expect(resolveInitialLimit(100_000)).toBe(maxInitialLoadLimit)
  })

  it('does not drop confirmed bar identity when merging newer tick rows', () => {
    const storeRow = {
      barKey: 'XAUUSDm|M5|1700000000',
      close: 10,
      globalIndex: 123,
      high: 11,
      identityStatus: 'confirmed',
      low: 9,
      open: 10,
      sessionId: 'XAUUSDm:2026-06-03',
      symbol: 'XAUUSDm',
      timestamp: 1_700_000_000_000,
      tradingDay: '2026-06-03',
      volume: 1,
    } as KLineData
    const tickRow = {
      close: 12,
      high: 12,
      low: 9,
      open: 10,
      timestamp: 1_700_000_000_000,
      volume: 2,
    } as KLineData

    const [merged] = mergeKLineData([storeRow], [tickRow]) as Array<KLineData & Record<string, unknown>>

    expect(merged.close).toBe(12)
    expect(merged.barKey).toBe('XAUUSDm|M5|1700000000')
    expect(merged.globalIndex).toBe(123)
    expect(merged.identityStatus).toBe('confirmed')
    expect(merged.tradingDay).toBe('2026-06-03')
  })
})
