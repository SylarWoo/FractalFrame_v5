import { describe, expect, it } from 'vitest'
import {
  isHistoryPageIndexCacheStaleAfterDailyRollover,
  resolveLastHistoryPageDailyRolloverAtMs,
  resolveNextHistoryPageDailyRolloverDelayMs,
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
})
