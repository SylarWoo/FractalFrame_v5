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

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

describe('buildM5TradingDaySlidingWeekPartition', () => {
  it('keeps the stopped session in realtime until the next 06:00 open prints a new bar', () => {
    const latestTime = Date.UTC(2026, 5, 5, 20, 55) / 1000
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      pageType: 'history',
      timeFrom: shanghaiSeconds(2026, 5, 29, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 5, 6, 0) - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 22, 6, 0),
      timeTo: shanghaiSeconds(2026, 5, 29, 6, 0) - 1,
    }))
    expect(partition.pages[2]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 15, 6, 0),
      timeTo: shanghaiSeconds(2026, 5, 22, 6, 0) - 1,
    }))
  })

  it('settles the previous stopped session after the next 06:00 open prints a new bar', () => {
    const latestTime = shanghaiSeconds(2026, 6, 8, 6, 0)
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      pageType: 'history',
      timeFrom: shanghaiSeconds(2026, 6, 1, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 8, 6, 0) - 1,
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

  it('does not fallback to row pages when latest time is missing', () => {
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime: null,
    })

    expect(partition.partitionMode).toBe('m5-time')
    expect(partition.pages).toEqual([])
    expect(partition.status).toBe('empty')
  })

  it('keeps Tuesday realtime separate from the first weekly history page', () => {
    const latestTime = shanghaiSeconds(2026, 6, 9, 6, 5)
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition(),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      pageType: 'history',
      timeFrom: shanghaiSeconds(2026, 6, 2, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 9, 6, 0) - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 26, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 2, 6, 0) - 1,
    }))
  })

  it('keeps 24/7 crypto weekly pages continuous across weekends on the Shanghai 06:00 boundary', () => {
    const latestTime = Date.UTC(2026, 5, 6, 20, 55) / 1000
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: fallbackPartition('BTCUSDm'),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 30, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 6, 6, 0) - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 23, 6, 0),
      timeTo: shanghaiSeconds(2026, 5, 30, 6, 0) - 1,
    }))
  })
})
