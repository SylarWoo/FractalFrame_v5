import type { TimeAlignedPageProfile } from './timeAlignedPageTypes'

const shanghaiOffsetSeconds = 8 * 60 * 60
const daySeconds = 24 * 60 * 60

function boundaryOffsetSeconds(profile: TimeAlignedPageProfile) {
  return (profile.boundaryHourShanghai * 60 + profile.boundaryMinuteShanghai) * 60 - shanghaiOffsetSeconds
}

function dayNumberAtShanghaiBoundary(seconds: number, profile: TimeAlignedPageProfile) {
  return Math.floor((seconds - boundaryOffsetSeconds(profile)) / daySeconds)
}

function boundaryFromDayNumber(dayNumber: number, profile: TimeAlignedPageProfile) {
  return dayNumber * daySeconds + boundaryOffsetSeconds(profile)
}

function shanghaiWeekday(seconds: number) {
  const date = new Date((seconds + shanghaiOffsetSeconds) * 1000)
  return date.getUTCDay()
}

function isWeekendBoundary(seconds: number) {
  const weekday = shanghaiWeekday(seconds)
  return weekday === 0 || weekday === 6
}

export function floorToTradingDayBoundarySeconds(seconds: number, profile: TimeAlignedPageProfile, options: { skipWeekends?: boolean } = {}) {
  if (!Number.isFinite(seconds)) return null
  const skipWeekends = options.skipWeekends !== false
  let dayNumber = dayNumberAtShanghaiBoundary(Math.floor(seconds), profile)
  let boundary = boundaryFromDayNumber(dayNumber, profile)
  while (skipWeekends && isWeekendBoundary(boundary)) {
    dayNumber -= 1
    boundary = boundaryFromDayNumber(dayNumber, profile)
  }
  return boundary
}

export function previousTradingDayBoundarySeconds(boundary: number, profile: TimeAlignedPageProfile, options: { skipWeekends?: boolean } = {}) {
  const skipWeekends = options.skipWeekends !== false
  let dayNumber = dayNumberAtShanghaiBoundary(boundary, profile) - 1
  let previous = boundaryFromDayNumber(dayNumber, profile)
  while (skipWeekends && isWeekendBoundary(previous)) {
    dayNumber -= 1
    previous = boundaryFromDayNumber(dayNumber, profile)
  }
  return previous
}

export function subtractCalendarDays(seconds: number, days: number) {
  return seconds - Math.max(0, Math.round(days)) * daySeconds
}
