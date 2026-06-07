const secondsPerDay = 86_400
const secondsPerHour = 3_600
const shanghaiUtcOffsetSeconds = 8 * secondsPerHour

function floorToLocalDay(seconds: number) {
  return Math.floor(seconds / secondsPerDay) * secondsPerDay
}

export function floorToTradingDayBoundarySeconds(seconds: number, options: {
  boundaryHour: number
  timezone: 'Asia/Shanghai'
}) {
  const localSeconds = seconds + shanghaiUtcOffsetSeconds
  const boundarySeconds = options.boundaryHour * secondsPerHour
  const localBoundary = Math.floor((localSeconds - boundarySeconds) / secondsPerDay) * secondsPerDay + boundarySeconds
  return localBoundary - shanghaiUtcOffsetSeconds
}

export function isShanghaiWeekendBoundary(boundarySeconds: number) {
  const localDayStart = floorToLocalDay(boundarySeconds + shanghaiUtcOffsetSeconds)
  const day = new Date((localDayStart - shanghaiUtcOffsetSeconds) * 1000).getUTCDay()
  return day === 0 || day === 6
}

export function previousTradingDayBoundarySeconds(boundarySeconds: number, options: {
  skipWeekends: boolean
}) {
  let candidate = boundarySeconds - secondsPerDay
  while (options.skipWeekends && isShanghaiWeekendBoundary(candidate)) {
    candidate -= secondsPerDay
  }
  return candidate
}

export function subtractCalendarDays(seconds: number, days: number) {
  return seconds - Math.max(0, Math.floor(days)) * secondsPerDay
}
