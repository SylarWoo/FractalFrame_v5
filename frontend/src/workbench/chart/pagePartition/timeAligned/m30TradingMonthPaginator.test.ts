import { describe, expect, it } from 'vitest'
import { buildRowsBasedPagePartition } from '../rowsBasedPagePartitionBuilder'
import { resolveM30RealtimeOpenFromHistoryClose } from './m30TradingAnchors'
import { buildM30TradingMonthPartition } from './m30TradingMonthPaginator'
import { estimateM30TimePageLimit, m30TradingMonthProfile } from './timeAlignedPageTypes'

function fallbackPartition(symbol = 'XAUUSDm', totalRows = 109_424) {
  return buildRowsBasedPagePartition({
    period: 'M30',
    symbol,
    totalRows,
  })
}

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

describe('buildM30TradingMonthPartition', () => {
  it('builds one history page from four completed trading weeks', () => {
    const partition = buildM30TradingMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 2_304),
      latestTime: shanghaiSeconds(2026, 6, 9, 6, 5),
    })

    expect(partition.partitionMode).toBe('m30-time')
    expect(partition.pages[0]).toEqual(expect.objectContaining({
      pageType: 'history',
      timeFrom: shanghaiSeconds(2026, 5, 11, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 6, 5, 0) - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 4, 13, 6, 0),
      timeTo: shanghaiSeconds(2026, 5, 9, 5, 0) - 1,
    }))
  })

  it('starts the realtime quasi-history at the next weekly open', () => {
    const historyTo = shanghaiSeconds(2026, 6, 6, 5, 0) - 1

    expect(resolveM30RealtimeOpenFromHistoryClose({
      historyTo,
      profile: m30TradingMonthProfile,
      symbol: 'XAUUSDm',
    })).toBe(shanghaiSeconds(2026, 6, 8, 6, 0))
  })

  it('uses the current week as completed only after the weekly close boundary', () => {
    const partition = buildM30TradingMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 1_152),
      latestTime: shanghaiSeconds(2026, 6, 6, 5, 0),
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 11, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 6, 5, 0) - 1,
    }))
  })

  it('estimates page count from the M30 monthly time capacity', () => {
    const partition = buildM30TradingMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 109_424),
      latestTime: shanghaiSeconds(2026, 6, 9, 6, 5),
    })

    expect(estimateM30TimePageLimit(m30TradingMonthProfile)).toBe(1_152)
    expect(partition.pages).toHaveLength(Math.ceil(109_424 / 1_152))
  })

  it('keeps 24/7 crypto pages continuous across weekends', () => {
    const partition = buildM30TradingMonthPartition({
      fallback: fallbackPartition('BTCUSDm', 2_304),
      latestTime: shanghaiSeconds(2026, 6, 9, 6, 5),
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 5, 11, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 8, 6, 0) - 1,
    }))
  })
})
