import { shouldSkipClosedWeekends } from '../pagePartition/timeAligned/timeAlignedTradingProfile'

const shanghaiOffsetMs = 8 * 60 * 60 * 1000

export function createShanghaiDateTimeFormat() {
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  })
}

export function nextShanghaiTradingOpen(timestamp: number, symbol?: string | null) {
  if (!shouldSkipClosedWeekends(symbol)) return timestamp
  const shanghaiDate = new Date(timestamp + shanghaiOffsetMs)
  const weekday = shanghaiDate.getUTCDay()
  if (weekday !== 0 && weekday !== 6) return timestamp
  const daysToMonday = weekday === 6 ? 2 : 1
  const mondayOpenShanghai = Date.UTC(
    shanghaiDate.getUTCFullYear(),
    shanghaiDate.getUTCMonth(),
    shanghaiDate.getUTCDate() + daysToMonday,
    6,
    0,
    0,
    0,
  )
  return mondayOpenShanghai - shanghaiOffsetMs
}

export function addShanghaiTradingTimeSteps(startTimestamp: number, stepMs: number, steps: number, symbol?: string | null) {
  let timestamp = startTimestamp
  const safeSteps = Math.max(0, Math.round(steps))
  for (let index = 0; index < safeSteps; index += 1) {
    timestamp = nextShanghaiTradingOpen(timestamp + stepMs, symbol)
  }
  return timestamp
}
