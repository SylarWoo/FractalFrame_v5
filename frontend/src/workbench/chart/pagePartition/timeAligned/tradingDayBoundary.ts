import type { TimeAlignedPageProfile } from './timeAlignedPageTypes'

const secondsPerDay = 86_400
const secondsPerHour = 3_600
const shanghaiUtcOffsetSeconds = 8 * secondsPerHour

function normalizeSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.floor(value)
}

export function isShanghaiWeekendBoundary(boundarySeconds: number) {
  const shanghaiDate = new Date((boundarySeconds + shanghaiUtcOffsetSeconds) * 1000)
  const day = shanghaiDate.getUTCDay()
  return day === 0 || day === 6
}

export function subtractCalendarDays(seconds: number, days: number) {
  return seconds - Math.max(0, Math.floor(days)) * secondsPerDay
}

export function previousTradingDayBoundarySeconds(boundarySeconds: number, profile: Pick<TimeAlignedPageProfile, 'skipWeekends'>) {
  let candidate = boundarySeconds - secondsPerDay
  while (profile.skipWeekends && isShanghaiWeekendBoundary(candidate)) {
    candidate -= secondsPerDay
  }
  return candidate
}

export function floorToTradingDayBoundarySeconds(
  seconds: number | null | undefined,
  profile: Pick<TimeAlignedPageProfile, 'boundaryHour' | 'skipWeekends' | 'timezone'>,
) {
  const normalized = normalizeSeconds(seconds)
  if (normalized == null) return null

  if (profile.timezone !== 'Asia/Shanghai') return null

  const localSeconds = normalized + shanghaiUtcOffsetSeconds
  const localBoundaryOffset = profile.boundaryHour * secondsPerHour
  const localBoundaryDay = Math.floor((localSeconds - localBoundaryOffset) / secondsPerDay)
  let boundary = localBoundaryDay * secondsPerDay + localBoundaryOffset - shanghaiUtcOffsetSeconds

  while (profile.skipWeekends && isShanghaiWeekendBoundary(boundary)) {
    boundary = previousTradingDayBoundarySeconds(boundary, profile)
  }

  return boundary
}
