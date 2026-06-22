import type { H2TimeAlignedPageProfile } from './timeAlignedPageTypes'

const shanghaiOffsetSeconds = 8 * 60 * 60
const monday = 1

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

function resolveEffectiveMonthAnchorDay(year: number, monthIndex: number) {
  const firstDayWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  return 1 + ((monday - firstDayWeekday + 7) % 7)
}

function shanghaiEffectiveMonthOpenSeconds(
  year: number,
  monthIndex: number,
  profile: Pick<H2TimeAlignedPageProfile, 'boundaryHourShanghai' | 'boundaryMinuteShanghai'>,
) {
  return shanghaiMonthOpenSecondsFromParts(
    year,
    monthIndex,
    resolveEffectiveMonthAnchorDay(year, monthIndex),
    profile,
  )
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
  return shanghaiEffectiveMonthOpenSeconds(targetYear, normalizedMonth, profile)
}

export function floorToShanghaiCalendarMonthOpenSeconds(
  seconds: number,
  profile: Pick<H2TimeAlignedPageProfile, 'boundaryHourShanghai' | 'boundaryMinuteShanghai'>,
) {
  const date = new Date((Math.floor(seconds) + shanghaiOffsetSeconds) * 1000)
  const current = shanghaiEffectiveMonthOpenSeconds(date.getUTCFullYear(), date.getUTCMonth(), profile)
  return Math.floor(seconds) >= current
    ? current
    : addShanghaiCalendarMonths(current, -1, profile)
}

export function resolveH2RealtimeOpenFromHistoryClose(options: {
  historyTo: number | null | undefined
  profile: H2TimeAlignedPageProfile
}) {
  if (typeof options.historyTo !== 'number' || !Number.isFinite(options.historyTo)) return null
  return Math.floor(options.historyTo) + 1
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
