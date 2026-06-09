export const m5TimeAlignedPartitionProfileVersion = 4
export const m30TimeAlignedPartitionProfileVersion = 2

export type TimeAlignedPageProfile = {
  boundaryHourShanghai: number
  boundaryMinuteShanghai: number
  windowDays: number
}

export const m5TradingDaySlidingWeekProfile: TimeAlignedPageProfile = {
  boundaryHourShanghai: 6,
  boundaryMinuteShanghai: 0,
  windowDays: 7,
}

export function estimateM5TimePageLimit(profile: TimeAlignedPageProfile) {
  return Math.ceil((profile.windowDays * 24 * 60) / 5)
}

export type M30TimeAlignedPageProfile = TimeAlignedPageProfile & {
  windowWeeks: number
}

export const m30TradingMonthProfile: M30TimeAlignedPageProfile = {
  boundaryHourShanghai: 6,
  boundaryMinuteShanghai: 0,
  windowDays: 28,
  windowWeeks: 4,
}

export function estimateM30TimePageLimit(profile: M30TimeAlignedPageProfile) {
  return Math.ceil((profile.windowWeeks * 6 * 24 * 60) / 30)
}
