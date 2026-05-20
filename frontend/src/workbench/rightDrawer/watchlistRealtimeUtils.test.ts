import { describe, expect, it } from 'vitest'
import type { Mt5RealtimeTick } from '../../services/mt5/mt5SymbolsApi'
import {
  appendWatchlistRealtimeLog,
  mergeWatchlistRealtimeTicks,
  watchlistRealtimeLogLimit,
} from './watchlistRealtimeUtils'

describe('watchlistRealtimeUtils', () => {
  it('prepends logs and keeps the newest limited entries', () => {
    const seed = Array.from({ length: watchlistRealtimeLogLimit }, (_, index) => `old-${index}`)

    const next = appendWatchlistRealtimeLog(seed, 'connected', '10:00:00')

    expect(next).toHaveLength(watchlistRealtimeLogLimit)
    expect(next[0]).toBe('10:00:00  connected')
    expect(next).not.toContain('old-7')
  })

  it('merges ticks by symbol and ignores symbol-less payloads', () => {
    const current: Record<string, Mt5RealtimeTick> = {
      XAUUSDm: { symbol: 'XAUUSDm', bid: 1, ask: 2 },
    }
    const ticks: Mt5RealtimeTick[] = [
      { symbol: 'XAUUSDm', bid: 3, ask: 4 },
      { symbol: 'EURUSDm', bid: 5, ask: 6 },
      { bid: 7, ask: 8 } as Mt5RealtimeTick,
    ]

    expect(mergeWatchlistRealtimeTicks(current, ticks)).toEqual({
      XAUUSDm: { symbol: 'XAUUSDm', bid: 3, ask: 4 },
      EURUSDm: { symbol: 'EURUSDm', bid: 5, ask: 6 },
    })
  })
})
