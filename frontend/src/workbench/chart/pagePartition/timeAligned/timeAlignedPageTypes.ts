export const m5TimeAlignedPartitionProfileVersion = 5
export const m30TimeAlignedPartitionProfileVersion = 3
export const h2TimeAlignedPartitionProfileVersion = 5

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

export type H2TimeAlignedPageProfile = TimeAlignedPageProfile & {
  historyWindowMonths: number
  realtimeWindowMonths: number
}

export const h2TradingFourMonthProfile: H2TimeAlignedPageProfile = {
  boundaryHourShanghai: 6,
  boundaryMinuteShanghai: 0,
  historyWindowMonths: 4,
  realtimeWindowMonths: 1,
  windowDays: 124,
}

export function estimateH2TimePageLimit(profile: H2TimeAlignedPageProfile) {
  return Math.ceil((profile.historyWindowMonths * 4 * 6 * 24 * 60) / 120)
}
