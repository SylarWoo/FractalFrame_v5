import { describe, expect, it } from 'vitest'
import { buildRowsBasedPagePartition } from '../rowsBasedPagePartitionBuilder'
import { buildM5TradingDaySlidingWeekPartition } from './m5TradingDaySlidingWeekPaginator'
import { m5TimeAlignedPartitionProfileVersion } from './timeAlignedPageTypes'

function utcSeconds(year: number, month: number, day: number, hour: number, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) / 1000
}

function buildFallback() {
  return buildRowsBasedPagePartition({
    period: 'M5',
    symbol: 'XAUUSDm',
    totalRows: 8_200,
  })
}

describe('buildM5TradingDaySlidingWeekPartition', () => {
  it('builds Thursday live and history pages from trading-day boundaries', () => {
    const latestTime = utcSeconds(2026, 1, 15, 6)
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: buildFallback(),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 1,
      pageType: 'live',
      realtime: true,
      rows: null,
      timeFrom: utcSeconds(2026, 1, 7, 22),
      timeTo: latestTime,
      toGlobalIndex: null,
    }))
    expect(partition.partitionMode).toBe('m5-time')
    expect(partition.profileVersion).toBe(m5TimeAlignedPartitionProfileVersion)
    expect(partition.pages[1]).toEqual(expect.objectContaining({
      fromGlobalIndex: null,
      index: 2,
      pageType: 'history',
      realtime: false,
      rows: null,
      timeFrom: utcSeconds(2026, 1, 6, 22),
      timeTo: utcSeconds(2026, 1, 13, 22),
      toGlobalIndex: null,
    }))
  })

  it('skips weekend boundaries when Monday history starts', () => {
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: buildFallback(),
      latestTime: utcSeconds(2026, 1, 19, 6),
    })

    expect(partition.pages[1]).toEqual(expect.objectContaining({
      timeFrom: utcSeconds(2026, 1, 8, 22),
      timeTo: utcSeconds(2026, 1, 15, 22),
    }))
  })

  it('uses the previous valid trading-day boundary before 06:00', () => {
    const latestTime = utcSeconds(2026, 1, 18, 21)
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: buildFallback(),
      latestTime,
    })

    expect(partition.pages[0]).toEqual(expect.objectContaining({
      timeFrom: utcSeconds(2026, 1, 8, 22),
      timeTo: latestTime,
    }))
  })

  it('keeps the fallback page count', () => {
    const fallback = buildFallback()
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback,
      latestTime: utcSeconds(2026, 1, 15, 6),
    })

    expect(partition.pages).toHaveLength(fallback.pages.length)
  })

  it('emits time pages without global index or row counts', () => {
    const partition = buildM5TradingDaySlidingWeekPartition({
      fallback: buildFallback(),
      latestTime: utcSeconds(2026, 1, 15, 6),
    })

    partition.pages.forEach((page) => {
      expect(page.fromGlobalIndex).toBeNull()
      expect(page.toGlobalIndex).toBeNull()
      expect(page.rows).toBeNull()
      expect(typeof page.timeFrom).toBe('number')
      expect(typeof page.timeTo).toBe('number')
      expect(Number.isFinite(page.timeFrom)).toBe(true)
      expect(Number.isFinite(page.timeTo)).toBe(true)
    })
  })
})
