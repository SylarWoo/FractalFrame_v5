import type {
  StoreV6PagePartition,
  StoreV6PagePartitionItem,
} from '../pagePartitionBuilder'
import { createPageIdentity } from '../../pageIdentity'
import {
  estimateM5TimePageLimit,
  m5TradingDaySlidingWeekProfile,
} from './timeAlignedPageTypes'
import {
  floorToTradingDayBoundarySeconds,
  previousTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'

function createTimePage(options: {
  index: number
  limit: number
  realtime: boolean
  period: string
  symbol: string
  timeFrom: number
  timeTo: number
}): StoreV6PagePartitionItem {
  const page: StoreV6PagePartitionItem = {
    fromGlobalIndex: null,
    index: options.index,
    limit: options.limit,
    pageType: options.realtime ? 'live' : 'history',
    realtime: options.realtime,
    rows: null,
    timeFrom: options.timeFrom,
    timeTo: options.timeTo,
    toGlobalIndex: null,
  }
  return {
    ...page,
    identity: createPageIdentity(page, options.symbol, options.period),
  }
}

export function buildM5TradingDaySlidingWeekPartition(options: {
  fallback: StoreV6PagePartition
  latestTime?: number | null
}): StoreV6PagePartition {
  const { fallback } = options
  if (fallback.period.trim().toUpperCase() !== 'M5') return fallback
  if (!fallback.pages.length) return fallback

  const latestTime = typeof options.latestTime === 'number' && Number.isFinite(options.latestTime)
    ? Math.floor(options.latestTime)
    : null
  if (latestTime == null) return fallback

  const profile = m5TradingDaySlidingWeekProfile
  const anchorBoundary = floorToTradingDayBoundarySeconds(latestTime, profile)
  if (anchorBoundary == null) return fallback

  const limit = estimateM5TimePageLimit(profile)
  const pages: StoreV6PagePartitionItem[] = [
    createTimePage({
      index: 1,
      limit,
      period: fallback.period,
      realtime: true,
      symbol: fallback.symbol,
      timeFrom: subtractCalendarDays(anchorBoundary, profile.windowDays),
      timeTo: latestTime,
    }),
  ]

  let historyTimeTo = previousTradingDayBoundarySeconds(anchorBoundary, profile)
  while (pages.length < fallback.pages.length) {
    pages.push(createTimePage({
      index: pages.length + 1,
      limit,
      period: fallback.period,
      realtime: false,
      symbol: fallback.symbol,
      timeFrom: subtractCalendarDays(historyTimeTo, profile.windowDays),
      timeTo: historyTimeTo,
    }))
    historyTimeTo = previousTradingDayBoundarySeconds(historyTimeTo, profile)
  }

  return {
    ...fallback,
    historyPageSize: limit,
    livePageSize: limit,
    pages,
    statusText: 'M5 时间分页已按交易日边界生成。',
  }
}
