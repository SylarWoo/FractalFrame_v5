import type { TimeAlignedPageProfile } from './timeAlignedPageTypes'
import {
  floorToTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import { resolveTimeAlignedTradingProfile } from './timeAlignedTradingProfile'

const daySeconds = 24 * 60 * 60

export type M5TradingAnchorSet = {
  completedTradingDayOpen: number
  historyFrom: number
  historyTo: number
  realtimeFrom: number
}

export function resolveM5SessionCloseBoundary(options: {
  anchorBoundary: number
  profile: ReturnType<typeof resolveTimeAlignedTradingProfile>
}) {
  const maintenance = options.profile.dailyMaintenance
  if (!maintenance) return options.anchorBoundary + daySeconds

  const closeOffset = (
    maintenance.closeHourShanghai * 60 * 60 +
    maintenance.closeMinuteShanghai * 60
  ) - (
    options.profile.boundaryHourShanghai * 60 * 60 +
    options.profile.boundaryMinuteShanghai * 60
  )
  const normalizedCloseOffset = closeOffset <= 0 ? closeOffset + daySeconds : closeOffset
  return options.anchorBoundary + normalizedCloseOffset
}

export function resolveCompletedM5TradingDayOpen(options: {
  anchorBoundary: number
  profile: ReturnType<typeof resolveTimeAlignedTradingProfile>
}) {
  return options.anchorBoundary
}

export function resolveNextM5TradingDayOpen(options: {
  boundaryOptions: { skipWeekends?: boolean }
  fromBoundary: number
  profile: TimeAlignedPageProfile
}) {
  let next = options.fromBoundary + daySeconds
  while (floorToTradingDayBoundarySeconds(next, options.profile, options.boundaryOptions) !== next) {
    next += daySeconds
  }
  return next
}

export function resolveM5TradingAnchors(options: {
  latestTime: number
  profile: TimeAlignedPageProfile
  symbol: string | null | undefined
}): M5TradingAnchorSet | null {
  const tradingProfile = resolveTimeAlignedTradingProfile(options.symbol)
  const boundaryOptions = { skipWeekends: tradingProfile.weekendClosed }
  const anchorBoundary = floorToTradingDayBoundarySeconds(options.latestTime, options.profile, boundaryOptions)
  if (anchorBoundary == null) return null
  const completedTradingDayOpen = resolveCompletedM5TradingDayOpen({
    anchorBoundary,
    profile: tradingProfile,
  })
  const realtimeFrom = anchorBoundary
  return {
    completedTradingDayOpen,
    historyFrom: subtractCalendarDays(completedTradingDayOpen, options.profile.windowDays),
    historyTo: realtimeFrom - 1,
    realtimeFrom,
  }
}

export function resolveM5RealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  profile: TimeAlignedPageProfile
  symbol: string | null | undefined
}) {
  if (typeof options.historyTo !== 'number' || !Number.isFinite(options.historyTo)) return null
  return Math.floor(options.historyTo) + 1
}
