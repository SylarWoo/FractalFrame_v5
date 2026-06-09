import type { TimeAlignedPageProfile } from './timeAlignedPageTypes'
import {
  floorToTradingDayBoundarySeconds,
  previousTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import { resolveTimeAlignedTradingProfile } from './timeAlignedTradingProfile'

const daySeconds = 24 * 60 * 60
const m5Seconds = 5 * 60

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
  boundaryOptions: { skipWeekends?: boolean }
  latestTime: number
  periodSeconds?: number
  profile: ReturnType<typeof resolveTimeAlignedTradingProfile>
}) {
  const sessionClose = resolveM5SessionCloseBoundary({
    anchorBoundary: options.anchorBoundary,
    profile: options.profile,
  })
  if (options.latestTime + (options.periodSeconds ?? m5Seconds) >= sessionClose) {
    return options.anchorBoundary
  }
  return previousTradingDayBoundarySeconds(options.anchorBoundary, {
    boundaryHourShanghai: options.profile.boundaryHourShanghai,
    boundaryMinuteShanghai: options.profile.boundaryMinuteShanghai,
    windowDays: 1,
  }, options.boundaryOptions)
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
    boundaryOptions,
    latestTime: options.latestTime,
    profile: tradingProfile,
  })
  const realtimeFrom = resolveNextM5TradingDayOpen({
    boundaryOptions,
    fromBoundary: completedTradingDayOpen,
    profile: options.profile,
  })
  return {
    completedTradingDayOpen,
    historyFrom: subtractCalendarDays(completedTradingDayOpen, options.profile.windowDays),
    historyTo: resolveM5SessionCloseBoundary({
      anchorBoundary: completedTradingDayOpen,
      profile: tradingProfile,
    }) - 1,
    realtimeFrom,
  }
}

export function resolveM5RealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  profile: TimeAlignedPageProfile
  symbol: string | null | undefined
}) {
  if (typeof options.historyTo !== 'number' || !Number.isFinite(options.historyTo)) return null
  const tradingProfile = resolveTimeAlignedTradingProfile(options.symbol)
  const boundaryOptions = { skipWeekends: tradingProfile.weekendClosed }
  const completedTradingDayOpen = floorToTradingDayBoundarySeconds(options.historyTo, options.profile, boundaryOptions)
  if (completedTradingDayOpen == null) return null
  return resolveNextM5TradingDayOpen({
    boundaryOptions,
    fromBoundary: completedTradingDayOpen,
    profile: options.profile,
  })
}
