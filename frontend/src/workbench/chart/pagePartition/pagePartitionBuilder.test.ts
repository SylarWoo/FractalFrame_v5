import { describe, expect, it } from 'vitest'
import { buildStoreV6PagePartition, resolveStoreV6PagePartitionMode } from './pagePartitionBuilder'
import { unsupportedStoreV6PeriodPageSystemTextV2 } from './periodPageSystemV2'

describe('buildStoreV6PagePartition', () => {
  function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
    return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
  }

  it('builds a live page from the newest 2000 rows and history pages from older rows', () => {
    const partition = buildStoreV6PagePartition({
      period: 'M15',
      symbol: 'XAUUSDm',
      totalRows: 8_200,
    })

    expect(partition.status).toBe('ready')
    expect(partition.pages).toEqual([
      expect.objectContaining({
        fromGlobalIndex: 6_200,
        index: 1,
        pageType: 'live',
        realtime: true,
        rows: 2_000,
        toGlobalIndex: 8_199,
      }),
      expect.objectContaining({
        fromGlobalIndex: 3_700,
        index: 2,
        pageType: 'history',
        realtime: false,
        rows: 2_500,
        toGlobalIndex: 6_199,
      }),
      expect.objectContaining({
        fromGlobalIndex: 1_200,
        index: 3,
        rows: 2_500,
        toGlobalIndex: 3_699,
      }),
      expect.objectContaining({
        fromGlobalIndex: 0,
        index: 4,
        rows: 1_200,
        toGlobalIndex: 1_199,
      }),
    ])
  })

  it('keeps a partial live page when StoreV6 has fewer than 2000 rows', () => {
    const partition = buildStoreV6PagePartition({
      period: 'M1',
      symbol: 'XAUUSDm',
      totalRows: 600,
    })

    expect(partition.status).toBe('insufficient_rows')
    expect(partition.pages).toEqual([
      expect.objectContaining({
        fromGlobalIndex: 0,
        index: 1,
        pageType: 'live',
        rows: 600,
        toGlobalIndex: 599,
      }),
    ])
  })

  it('builds M5 time page labels before StoreV6 index materialization', () => {
    const latestTime = Date.UTC(2026, 0, 15, 6, 0) / 1000
    const partition = buildStoreV6PagePartition({
      latestTime,
      period: 'M5',
      symbol: 'XAUUSDm',
      totalRows: 8_200,
    })

    expect(partition.status).toBe('ready')
    expect(partition.partitionMode).toBe('m5-time')
    expect(partition.pages[0]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 1,
      pageType: 'history',
      realtime: false,
      rows: null,
      timeFrom: shanghaiSeconds(2026, 1, 8, 6, 0),
      timeTo: shanghaiSeconds(2026, 1, 15, 6, 0) - 1,
      toGlobalIndex: null,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 2,
      pageType: 'history',
      realtime: false,
      rows: null,
      toGlobalIndex: null,
    }))
    expect(typeof partition.pages[0]?.timeFrom).toBe('number')
    expect(typeof partition.pages[1]?.timeFrom).toBe('number')
    expect(typeof partition.pages[1]?.timeTo).toBe('number')
  })

  it('routes only registered periods to the independent period page systems', () => {
    expect(resolveStoreV6PagePartitionMode('M5')).toBe('m5-time')
    expect(resolveStoreV6PagePartitionMode('M30')).toBe('m30-time')
    expect(resolveStoreV6PagePartitionMode('H2')).toBe('h2-time')
    expect(resolveStoreV6PagePartitionMode('H1')).toBe('rows')
  })

  it('keeps unsupported period page-system text readable', () => {
    expect(unsupportedStoreV6PeriodPageSystemTextV2('H1')).toContain('H1 暂未接入独立周期分页系统')
  })
})
