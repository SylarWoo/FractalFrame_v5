import { describe, expect, it } from 'vitest'
import { buildStoreV6PagePartition } from './pagePartitionBuilder'

describe('buildStoreV6PagePartition', () => {
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

  it('routes M5 to time aligned pages through the single partition entry', () => {
    const latestTime = Date.UTC(2026, 0, 15, 6, 0) / 1000
    const partition = buildStoreV6PagePartition({
      latestTime,
      period: 'M5',
      symbol: 'XAUUSDm',
      totalRows: 8_200,
    })

    expect(partition.status).toBe('ready')
    expect(partition.pages[0]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 1,
      pageType: 'live',
      realtime: true,
      rows: null,
      timeFrom: Date.UTC(2026, 0, 7, 22, 0) / 1000,
      timeTo: latestTime,
      toGlobalIndex: null,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 2,
      pageType: 'history',
      realtime: false,
      rows: null,
      timeFrom: Date.UTC(2026, 0, 6, 22, 0) / 1000,
      timeTo: Date.UTC(2026, 0, 13, 22, 0) / 1000,
      toGlobalIndex: null,
    }))
  })
})
