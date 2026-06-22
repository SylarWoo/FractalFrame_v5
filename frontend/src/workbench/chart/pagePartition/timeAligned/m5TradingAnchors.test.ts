import { describe, expect, it } from 'vitest'
import {
  resolveM5RealtimeOpenFromHistoryClose,
  resolveM5TradingAnchors,
} from './m5TradingAnchors'
import { m5TradingDaySlidingWeekProfile } from './timeAlignedPageTypes'

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

describe('m5TradingAnchors', () => {
  it('locks the three M5 anchors when the current session is Tuesday', () => {
    const anchors = resolveM5TradingAnchors({
      latestTime: shanghaiSeconds(2026, 6, 9, 6, 5),
      profile: m5TradingDaySlidingWeekProfile,
      symbol: 'XAUUSDm',
    })

    expect(anchors).toEqual({
      completedTradingDayOpen: shanghaiSeconds(2026, 6, 9, 6, 0),
      historyFrom: shanghaiSeconds(2026, 6, 2, 6, 0),
      historyTo: shanghaiSeconds(2026, 6, 9, 6, 0) - 1,
      realtimeFrom: shanghaiSeconds(2026, 6, 9, 6, 0),
    })
  })

  it('slides the same anchors forward for a Wednesday session', () => {
    const anchors = resolveM5TradingAnchors({
      latestTime: shanghaiSeconds(2026, 6, 10, 6, 5),
      profile: m5TradingDaySlidingWeekProfile,
      symbol: 'XAUUSDm',
    })

    expect(anchors).toEqual({
      completedTradingDayOpen: shanghaiSeconds(2026, 6, 10, 6, 0),
      historyFrom: shanghaiSeconds(2026, 6, 3, 6, 0),
      historyTo: shanghaiSeconds(2026, 6, 10, 6, 0) - 1,
      realtimeFrom: shanghaiSeconds(2026, 6, 10, 6, 0),
    })
  })

  it('resolves the realtime open anchor from the latest history close', () => {
    expect(resolveM5RealtimeOpenFromHistoryClose({
      historyTo: shanghaiSeconds(2026, 6, 10, 6, 0) - 1,
      profile: m5TradingDaySlidingWeekProfile,
      symbol: 'XAUUSDm',
    })).toBe(shanghaiSeconds(2026, 6, 10, 6, 0))
  })

  it('skips closed weekends for the realtime open anchor', () => {
    expect(resolveM5RealtimeOpenFromHistoryClose({
      historyTo: shanghaiSeconds(2026, 6, 8, 6, 0) - 1,
      profile: m5TradingDaySlidingWeekProfile,
      symbol: 'XAUUSDm',
    })).toBe(shanghaiSeconds(2026, 6, 8, 6, 0))
  })
})
