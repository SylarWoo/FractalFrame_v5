import {
  estimateM5CalendarPageLimit,
  m5CalendarPageProfile,
} from './calendarPageProfiles'
import {
  floorToTradingDayBoundarySeconds,
  previousTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import type { StoreV6PagePartition, StoreV6PagePartitionItem } from './pagePartitionBuilder'

function normalizeLatestTimeSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.floor(value > 10_000_000_000 ? value / 1000 : value)
}

export function isM5CalendarPagePeriod(period: string | null | undefined) {
  return String(period ?? '').trim().toUpperCase() === 'M5'
}

function createCalendarPage(index: number, realtime: boolean, timeFrom: number, timeTo: number): StoreV6PagePartitionItem {
  return {
    fromGlobalIndex: null,
    index,
    limit: estimateM5CalendarPageLimit(),
    pageType: realtime ? 'live' : 'history',
    realtime,
    rows: null,
    timeFrom,
    timeTo,
    toGlobalIndex: null,
  }
}

export function buildM5CalendarPagePartition(options: {
  fallback: StoreV6PagePartition
  latestTime?: number | null
}): StoreV6PagePartition {
  if (!isM5CalendarPagePeriod(options.fallback.period)) return options.fallback
  const latestTime = normalizeLatestTimeSeconds(options.latestTime)
  if (latestTime == null) {
    return {
      ...options.fallback,
      statusText: `${options.fallback.statusText} M5 时间分页缺少 latestTime，已回退 rows-based 分页。`,
    }
  }

  const latestBoundary = floorToTradingDayBoundarySeconds(latestTime, {
    boundaryHour: m5CalendarPageProfile.boundaryHour,
    timezone: m5CalendarPageProfile.timezone,
  })
  const pages: StoreV6PagePartitionItem[] = [
    createCalendarPage(
      1,
      true,
      subtractCalendarDays(latestBoundary, m5CalendarPageProfile.windowDays),
      latestTime,
    ),
  ]
  const maxHistoryPages = Math.max(0, options.fallback.pages.length - 1)
  let historyTo = previousTradingDayBoundarySeconds(latestBoundary, {
    skipWeekends: m5CalendarPageProfile.skipWeekends,
  })

  for (let index = 2; index <= maxHistoryPages + 1; index += 1) {
    pages.push(createCalendarPage(
      index,
      false,
      subtractCalendarDays(historyTo, m5CalendarPageProfile.windowDays),
      historyTo,
    ))
    historyTo = previousTradingDayBoundarySeconds(historyTo, {
      skipWeekends: m5CalendarPageProfile.skipWeekends,
    })
  }

  return {
    ...options.fallback,
    historyPageSize: estimateM5CalendarPageLimit(),
    livePageSize: estimateM5CalendarPageLimit(),
    pages,
    status: 'ready',
    statusText: `M5 已按 ${m5CalendarPageProfile.timezone} ${String(m5CalendarPageProfile.boundaryHour).padStart(2, '0')}:00 生成 7 天时间分页；打开页面时再查询 K 线。`,
  }
}
