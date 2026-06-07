export type TimeAlignedPageProfile = {
  boundaryHour: number
  skipWeekends: boolean
  timezone: 'Asia/Shanghai'
  windowDays: number
}

export const m5TradingDaySlidingWeekProfile: TimeAlignedPageProfile = {
  boundaryHour: 6,
  skipWeekends: true,
  timezone: 'Asia/Shanghai',
  windowDays: 7,
}

export function estimateM5TimePageLimit(profile = m5TradingDaySlidingWeekProfile) {
  return profile.windowDays * 24 * 12 + 256
}
