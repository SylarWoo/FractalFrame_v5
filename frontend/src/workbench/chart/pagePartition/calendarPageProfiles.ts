export const m5CalendarPageProfile = {
  boundaryHour: 6,
  fallbackHistoryPageSize: 2_500,
  fallbackLivePageSize: 2_000,
  limitPaddingRows: 256,
  skipWeekends: true,
  timezone: 'Asia/Shanghai',
  windowDays: 7,
} as const

export function estimateM5CalendarPageLimit(days = m5CalendarPageProfile.windowDays) {
  return days * 24 * 12 + m5CalendarPageProfile.limitPaddingRows
}
