import type { M30TimeAlignedPageProfile } from './timeAlignedPageTypes'
import {
  floorToTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import { resolveTimeAlignedTradingProfile } from './timeAlignedTradingProfile'

const daySeconds = 24 * 60 * 60
const shanghaiOffsetSeconds = 8 * 60 * 60

export type M30TradingAnchorSet = {
  completedTradingWeekOpen: number
  historyFrom: number
  historyTo: number
  realtimeFrom: number
}

function shanghaiWeekday(seconds: number) {
  const date = new Date((seconds + shanghaiOffsetSeconds) * 1000)
  return date.getUTCDay()
}

function mondayOpenFromTradingDayBoundary(boundary: number) {
  const weekday = shanghaiWeekday(boundary)
  const mondayOffset = (weekday + 6) % 7
  return boundary - mondayOffset * daySeconds
}

export function resolveCompletedM30TradingWeekOpen(options: {
  latestTime: number
  profile: M30TimeAlignedPageProfile
  symbol: string | null | undefined
}) {
  const tradingProfile = resolveTimeAlignedTradingProfile(options.symbol)
  const dayBoundary = floorToTradingDayBoundarySeconds(options.latestTime, options.profile, {
    skipWeekends: tradingProfile.weekendClosed,
  })
  if (dayBoundary == null) return null
  return mondayOpenFromTradingDayBoundary(dayBoundary)
}

export function resolveM30RealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  profile: M30TimeAlignedPageProfile
  symbol: string | null | undefined
}) {
  if (typeof options.historyTo !== 'number' || !Number.isFinite(options.historyTo)) return null
  return Math.floor(options.historyTo) + 1
}

export function resolveM30TradingAnchors(options: {
  latestTime: number
  profile: M30TimeAlignedPageProfile
  symbol: string | null | undefined
}): M30TradingAnchorSet | null {
  const completedTradingWeekOpen = resolveCompletedM30TradingWeekOpen({
    latestTime: Math.floor(options.latestTime),
    profile: options.profile,
    symbol: options.symbol,
  })
  if (completedTradingWeekOpen == null) return null
  return {
    completedTradingWeekOpen,
    historyFrom: subtractCalendarDays(completedTradingWeekOpen, options.profile.windowWeeks * 7),
    historyTo: completedTradingWeekOpen - 1,
    realtimeFrom: completedTradingWeekOpen,
  }
}
