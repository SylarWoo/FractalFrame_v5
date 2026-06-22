import { describe, expect, it } from 'vitest'
import { buildRowsBasedPagePartition } from '../rowsBasedPagePartitionBuilder'
import { buildH2TradingFourMonthPartition } from './h2TradingFourMonthPaginator'
import { resolveH2RealtimeOpenFromHistoryClose } from './h2TradingMonthAnchors'
import { estimateH2TimePageLimit, h2TradingFourMonthProfile } from './timeAlignedPageTypes'

function fallbackPartition(symbol = 'XAUUSDm', totalRows = 12_000) {
  return buildRowsBasedPagePartition({
    period: 'H2',
    symbol,
    totalRows,
  })
}

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

describe('buildH2TradingFourMonthPartition', () => {
  it('uses the current Shanghai month as realtime and the previous four months as page 1', () => {
    const partition = buildH2TradingFourMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 2_304),
      latestTime: shanghaiSeconds(2026, 6, 11, 22, 30),
    })

    expect(partition.partitionMode).toBe('h2-time')
    expect(partition.pages[0]).toEqual(expect.objectContaining({
      pageType: 'history',
      timeFrom: shanghaiSeconds(2026, 2, 2, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 1, 6, 0) - 1,
    }))
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2025, 10, 6, 6, 0),
      timeTo: shanghaiSeconds(2026, 2, 2, 6, 0) - 1,
    }))
  })

  it('does not roll page 1 forward before the first Monday monthly open', () => {
    const partition = buildH2TradingFourMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 2_304),
      latestTime: shanghaiSeconds(2026, 7, 1, 6, 0),
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 2, 2, 6, 0),
      timeTo: shanghaiSeconds(2026, 6, 1, 6, 0) - 1,
    }))
  })

  it('rolls page 1 forward when the first Monday monthly open prints', () => {
    const partition = buildH2TradingFourMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 2_304),
      latestTime: shanghaiSeconds(2026, 7, 6, 6, 0),
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: shanghaiSeconds(2026, 3, 2, 6, 0),
      timeTo: shanghaiSeconds(2026, 7, 6, 6, 0) - 1,
    }))
  })

  it('starts the realtime quasi-history at the month after history page close', () => {
    const historyTo = shanghaiSeconds(2026, 6, 1, 6, 0) - 1

    expect(resolveH2RealtimeOpenFromHistoryClose({
      historyTo,
      profile: h2TradingFourMonthProfile,
    })).toBe(shanghaiSeconds(2026, 6, 1, 6, 0))
  })

  it('estimates page count from the four-month H2 capacity', () => {
    const partition = buildH2TradingFourMonthPartition({
      fallback: fallbackPartition('XAUUSDm', 12_000),
      latestTime: shanghaiSeconds(2026, 6, 11, 22, 30),
    })

    expect(estimateH2TimePageLimit(h2TradingFourMonthProfile)).toBe(1_152)
    expect(partition.pages).toHaveLength(Math.ceil(12_000 / 1_152))
  })
})
