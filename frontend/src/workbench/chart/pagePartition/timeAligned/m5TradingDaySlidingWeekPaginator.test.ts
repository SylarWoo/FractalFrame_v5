import { describe, expect, it } from 'vitest'
import { buildRowsBasedPagePartition } from '../rowsBasedPagePartitionBuilder'
import { buildM5TradingDaySlidingWeekPartition } from './m5TradingDaySlidingWeekPaginator'

function fallbackPartition(symbol = 'XAUUSDm') {
  return buildRowsBasedPagePartition({
    period: 'M5',
    symbol,
    totalRows: 8_200,
  })
}

describe('buildM5TradingDaySlidingWeekPartition', () => {
  it('builds history pages from the previous boundary of the live page start', () => {
    const latestTime = Date.UTC(2026, 5, 5, 20, 55) / 1000
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: Date.UTC(2026, 4, 28, 22, 0) / 1000,
      timeTo: Date.UTC(2026, 5, 4, 22, 0) / 1000 - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: Date.UTC(2026, 4, 20, 22, 0) / 1000,
      timeTo: Date.UTC(2026, 4, 28, 22, 0) / 1000 - 1,
    }))
    expect(partition.pages[2]).toEqual(expect.objectContaining({
      timeFrom: Date.UTC(2026, 4, 12, 22, 0) / 1000,
      timeTo: Date.UTC(2026, 4, 20, 22, 0) / 1000 - 1,
    }))
  })

  it('builds time labels without mixing row ranges', () => {
    const latestTime = Date.UTC(2026, 0, 15, 6, 0) / 1000
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime,
    })

    expect(partition.partitionMode).toBe('m5-time')
    expect(partition.pages).toHaveLength(4)
    expect(partition.pages[0]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 1,
      pageType: 'live',
      realtime: false,
      rows: null,
      timeTo: Date.UTC(2026, 0, 14, 22, 0) / 1000 - 1,
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

  it('does not fallback to row pages when latest time is missing', () => {
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime: null,
    })

    expect(partition.partitionMode).toBe('m5-time')
    expect(partition.pages).toEqual([])
    expect(partition.status).toBe('empty')
  })

  it('keeps 24/7 crypto pages continuous across weekends on the Shanghai 06:00 boundary', () => {
    const latestTime = Date.UTC(2026, 5, 6, 20, 55) / 1000
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition('BTCUSDm'),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: Date.UTC(2026, 4, 29, 22, 0) / 1000,
      timeTo: Date.UTC(2026, 5, 5, 22, 0) / 1000 - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: Date.UTC(2026, 4, 28, 22, 0) / 1000,
      timeTo: Date.UTC(2026, 5, 4, 22, 0) / 1000 - 1,
    }))
  })
})
