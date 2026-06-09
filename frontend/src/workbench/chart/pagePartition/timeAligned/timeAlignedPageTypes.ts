export const m5TimeAlignedPartitionProfileVersion = 4

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
