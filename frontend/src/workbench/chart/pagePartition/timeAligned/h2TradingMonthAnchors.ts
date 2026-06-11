import type { H2TimeAlignedPageProfile } from './timeAlignedPageTypes'

const shanghaiOffsetSeconds = 8 * 60 * 60

function shanghaiMonthOpenSecondsFromParts(
  year: number,
  monthIndex: number,
  day: number,
  profile: Pick<H2TimeAlignedPageProfile, 'boundaryHourShanghai' | 'boundaryMinuteShanghai'>,
) {
  return Math.floor(Date.UTC(
    year,
    monthIndex,
    day,
    profile.boundaryHourShanghai - 8,
    profile.boundaryMinuteShanghai,
    0,
    0,
  ) / 1000)
}

function daysInShanghaiMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function addShanghaiCalendarMonths(
  seconds: number,
  months: number,
  profile: Pick<H2TimeAlignedPageProfile, 'boundaryHourShanghai' | 'boundaryMinuteShanghai'>,
) {
  const date = new Date((Math.floor(seconds) + shanghaiOffsetSeconds) * 1000)
  const targetMonth = date.getUTCMonth() + months
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const day = Math.min(date.getUTCDate(), daysInShanghaiMonth(targetYear, normalizedMonth))
  return shanghaiMonthOpenSecondsFromParts(targetYear, normalizedMonth, day, profile)
}

export function floorToShanghaiCalendarMonthOpenSeconds(
  seconds: number,
  profile: Pick<H2TimeAlignedPageProfile, 'boundaryHourShanghai' | 'boundaryMinuteShanghai'>,
) {
  const date = new Date((Math.floor(seconds) + shanghaiOffsetSeconds) * 1000)
  const current = shanghaiMonthOpenSecondsFromParts(date.getUTCFullYear(), date.getUTCMonth(), 1, profile)
  return Math.floor(seconds) >= current
    ? current
    : addShanghaiCalendarMonths(current, -1, profile)
}

export function resolveH2RealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  profile: H2TimeAlignedPageProfile
}) {
  if (typeof options.historyTo !== 'number' || !Number.isFinite(options.historyTo)) return null
  const historyCloseBoundary = Math.floor(options.historyTo) + 1
  return floorToShanghaiCalendarMonthOpenSeconds(historyCloseBoundary, options.profile)
}

export function resolveH2TradingAnchors(options: {
  latestTime: number
  profile: H2TimeAlignedPageProfile
}) {
  const realtimeOpen = floorToShanghaiCalendarMonthOpenSeconds(options.latestTime, options.profile)
  const historyFrom = addShanghaiCalendarMonths(realtimeOpen, -options.profile.historyWindowMonths, options.profile)
  return {
    historyFrom,
    historyTo: realtimeOpen - 1,
    realtimeFrom: realtimeOpen,
  }
}
