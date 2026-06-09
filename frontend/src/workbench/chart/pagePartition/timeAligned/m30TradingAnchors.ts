import type { M30TimeAlignedPageProfile } from './timeAlignedPageTypes'
import {
  floorToTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import { resolveTimeAlignedTradingProfile } from './timeAlignedTradingProfile'

const daySeconds = 24 * 60 * 60
const m30Seconds = 30 * 60
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

function previousTradingWeekOpen(weekOpen: number) {
  return weekOpen - 7 * daySeconds
}

export function resolveM30WeekCloseBoundary(options: {
  weekOpen: number
  symbol: string | null | undefined
}) {
  const tradingProfile = resolveTimeAlignedTradingProfile(options.symbol)
  if (!tradingProfile.weekendClosed) return options.weekOpen + 7 * daySeconds
  const maintenance = tradingProfile.dailyMaintenance
  if (!maintenance) return options.weekOpen + 5 * daySeconds
  const boundaryOffset = tradingProfile.boundaryHourShanghai * 60 * 60 + tradingProfile.boundaryMinuteShanghai * 60
  const closeOffset = maintenance.closeHourShanghai * 60 * 60 + maintenance.closeMinuteShanghai * 60
  const normalizedCloseOffset = closeOffset <= boundaryOffset
    ? closeOffset - boundaryOffset + daySeconds
    : closeOffset - boundaryOffset
  return options.weekOpen + 4 * daySeconds + normalizedCloseOffset
}

export function resolveCompletedM30TradingWeekOpen(options: {
  latestTime: number
  periodSeconds?: number
  profile: M30TimeAlignedPageProfile
  symbol: string | null | undefined
}) {
  const tradingProfile = resolveTimeAlignedTradingProfile(options.symbol)
  const dayBoundary = floorToTradingDayBoundarySeconds(options.latestTime, options.profile, {
    skipWeekends: tradingProfile.weekendClosed,
  })
  if (dayBoundary == null) return null
  const currentWeekOpen = mondayOpenFromTradingDayBoundary(dayBoundary)
  const weekClose = resolveM30WeekCloseBoundary({
    symbol: options.symbol,
    weekOpen: currentWeekOpen,
  })
  return options.latestTime + (options.periodSeconds ?? m30Seconds) >= weekClose
    ? currentWeekOpen
    : previousTradingWeekOpen(currentWeekOpen)
}

export function resolveM30RealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  profile: M30TimeAlignedPageProfile
  symbol: string | null | undefined
}) {
  if (typeof options.historyTo !== 'number' || !Number.isFinite(options.historyTo)) return null
  const tradingProfile = resolveTimeAlignedTradingProfile(options.symbol)
  const dayBoundary = floorToTradingDayBoundarySeconds(options.historyTo, options.profile, {
    skipWeekends: tradingProfile.weekendClosed,
  })
  if (dayBoundary == null) return null
  return mondayOpenFromTradingDayBoundary(dayBoundary) + 7 * daySeconds
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
  const historyFrom = subtractCalendarDays(completedTradingWeekOpen, (options.profile.windowWeeks - 1) * 7)
  return {
    completedTradingWeekOpen,
    historyFrom,
    historyTo: resolveM30WeekCloseBoundary({
      symbol: options.symbol,
      weekOpen: completedTradingWeekOpen,
    }) - 1,
    realtimeFrom: completedTradingWeekOpen + 7 * daySeconds,
  }
}
