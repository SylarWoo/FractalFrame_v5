import { describe, expect, it } from 'vitest'
import {
  isHistoryPageIndexCacheStaleAfterDailyRollover,
  isHistoryPageIndexCacheStaleAfterRollover,
  resolveLastHistoryPageDailyRolloverAtMs,
  resolveLastHistoryPageRolloverAtMs,
  resolveNextHistoryPageDailyRolloverDelayMs,
  resolveNextHistoryPageRolloverDelayMs,
} from './historyPageDailyRolloverV2'

function shanghaiMs(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute)
}

describe('historyPageDailyRolloverV2', () => {
  it('schedules history page rollover after the next Shanghai daily close for non-crypto symbols', () => {
    const nowMs = shanghaiMs(2026, 6, 9, 4, 50)
    const delay = resolveNextHistoryPageDailyRolloverDelayMs({
      nowMs,
      symbol: 'XAUUSDm',
    })

    expect(delay).toBe(shanghaiMs(2026, 6, 9, 5, 1) - nowMs)
  })

  it('skips daily rollover for continuous crypto symbols', () => {
    expect(resolveNextHistoryPageDailyRolloverDelayMs({
      nowMs: shanghaiMs(2026, 6, 9, 4, 50),
      symbol: 'BTCUSDm',
    })).toBeNull()
  })

  it('resolves the most recent rollover point after Shanghai daily close', () => {
    expect(resolveLastHistoryPageDailyRolloverAtMs({
      nowMs: shanghaiMs(2026, 6, 9, 7, 0),
      symbol: 'XAUUSDm',
    })).toBe(shanghaiMs(2026, 6, 9, 5, 1))
  })

  it('marks page index cache stale when it was built before the latest daily rollover', () => {
    expect(isHistoryPageIndexCacheStaleAfterDailyRollover({
      builtAt: new Date(shanghaiMs(2026, 6, 8, 23, 0)).toISOString(),
      nowMs: shanghaiMs(2026, 6, 9, 7, 0),
      symbol: 'XAUUSDm',
    })).toBe(true)

    expect(isHistoryPageIndexCacheStaleAfterDailyRollover({
      builtAt: new Date(shanghaiMs(2026, 6, 9, 6, 0)).toISOString(),
      nowMs: shanghaiMs(2026, 6, 9, 7, 0),
      symbol: 'XAUUSDm',
    })).toBe(false)
  })

  it('schedules M30 page rollover after the next Shanghai Friday close', () => {
    const nowMs = shanghaiMs(2026, 6, 12, 4, 50)
    const delay = resolveNextHistoryPageRolloverDelayMs({
      nowMs,
      period: 'M30',
      symbol: 'XAUUSDm',
    })

    expect(delay).toBe(shanghaiMs(2026, 6, 12, 5, 1) - nowMs)
  })

  it('marks M30 page index cache stale after weekly rollover', () => {
    expect(resolveLastHistoryPageRolloverAtMs({
      nowMs: shanghaiMs(2026, 6, 12, 7, 0),
      period: 'M30',
      symbol: 'XAUUSDm',
    })).toBe(shanghaiMs(2026, 6, 12, 5, 1))

    expect(isHistoryPageIndexCacheStaleAfterRollover({
      builtAt: new Date(shanghaiMs(2026, 6, 11, 23, 0)).toISOString(),
      nowMs: shanghaiMs(2026, 6, 12, 7, 0),
      period: 'M30',
      symbol: 'XAUUSDm',
    })).toBe(true)
  })

  it('schedules H2 page rollover after the last Shanghai trading-day close of the month', () => {
    const nowMs = shanghaiMs(2026, 5, 29, 4, 50)
    const delay = resolveNextHistoryPageRolloverDelayMs({
      nowMs,
      period: 'H2',
      symbol: 'XAUUSDm',
    })

    expect(delay).toBe(shanghaiMs(2026, 5, 29, 5, 1) - nowMs)
  })

  it('marks H2 page index cache stale after monthly rollover', () => {
    expect(resolveLastHistoryPageRolloverAtMs({
      nowMs: shanghaiMs(2026, 6, 30, 7, 0),
      period: 'H2',
      symbol: 'XAUUSDm',
    })).toBe(shanghaiMs(2026, 6, 30, 5, 1))

    expect(isHistoryPageIndexCacheStaleAfterRollover({
      builtAt: new Date(shanghaiMs(2026, 6, 29, 23, 0)).toISOString(),
      nowMs: shanghaiMs(2026, 6, 30, 7, 0),
      period: 'H2',
      symbol: 'XAUUSDm',
    })).toBe(true)
  })
})
