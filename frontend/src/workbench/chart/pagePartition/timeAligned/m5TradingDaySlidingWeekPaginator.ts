import { createPageIdentity } from '../../pageIdentity'
import type { StoreV6PagePartition, StoreV6PagePartitionItem } from '../pagePartitionBuilder'
import {
  estimateM5TimePageLimit,
  m5TimeAlignedPartitionProfileVersion,
  m5TradingDaySlidingWeekProfile,
} from './timeAlignedPageTypes'
import {
  floorToTradingDayBoundarySeconds,
  previousTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import { resolveTimeAlignedTradingProfile } from './timeAlignedTradingProfile'

function createTimePage(options: {
  index: number
  limit: number
  period: string
  symbol: string
  timeFrom: number
  timeTo: number
}): StoreV6PagePartitionItem {
  const page: StoreV6PagePartitionItem = {
    fromGlobalIndex: null,
    index: options.index,
    limit: options.limit,
    pageType: options.index === 1 ? 'live' : 'history',
    realtime: false,
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
  const timeFallback: StoreV6PagePartition = {
    ...fallback,
    partitionMode: 'm5-time',
    profileVersion: m5TimeAlignedPartitionProfileVersion,
  }
  if (fallback.period.trim().toUpperCase() !== 'M5') return fallback
  if (!fallback.pages.length) return timeFallback

  const latestTime = typeof options.latestTime === 'number' && Number.isFinite(options.latestTime)
    ? Math.floor(options.latestTime)
    : null
  if (latestTime == null) {
    return {
      ...timeFallback,
      pages: [],
      status: 'empty',
      statusText: 'M5 时间分页已启用，等待 StoreV6 最新 K 线时间后生成时间页表。',
    }
  }

  const tradingProfile = resolveTimeAlignedTradingProfile(fallback.symbol)
  const profile = {
    ...m5TradingDaySlidingWeekProfile,
    boundaryHourShanghai: tradingProfile.boundaryHourShanghai,
    boundaryMinuteShanghai: tradingProfile.boundaryMinuteShanghai,
  }
  const boundaryOptions = { skipWeekends: tradingProfile.weekendClosed }
  const anchorBoundary = floorToTradingDayBoundarySeconds(latestTime, profile, boundaryOptions)
  if (anchorBoundary == null) {
    return {
      ...timeFallback,
      pages: [],
      status: 'empty',
      statusText: 'M5 时间分页已启用，但无法识别交易日边界。',
    }
  }

  const limit = estimateM5TimePageLimit(profile)
  const liveTimeFrom = subtractCalendarDays(anchorBoundary, profile.windowDays)
  if (!tradingProfile.weekendClosed) {
    const windowSeconds = profile.windowDays * 24 * 60 * 60
    const pages: StoreV6PagePartitionItem[] = []
    let pageTimeFrom = liveTimeFrom
    while (pages.length < fallback.pages.length) {
      pages.push(createTimePage({
        index: pages.length + 1,
        limit,
        period: fallback.period,
        symbol: fallback.symbol,
        timeFrom: pageTimeFrom,
        timeTo: pageTimeFrom + windowSeconds - 1,
      }))
      pageTimeFrom = previousTradingDayBoundarySeconds(pageTimeFrom, profile, boundaryOptions)
    }

    return {
      ...timeFallback,
      historyPageSize: limit,
      livePageSize: limit,
      pages,
      statusText: 'M5 时间分页已启用，时间边界将解析为 StoreV6 globalIndex 后显示。',
    }
  }

  const pages: StoreV6PagePartitionItem[] = [
    createTimePage({
      index: 1,
      limit,
      period: fallback.period,
      symbol: fallback.symbol,
      timeFrom: liveTimeFrom,
      timeTo: anchorBoundary - 1,
    }),
  ]

  let newerPageStart = liveTimeFrom
  while (pages.length < fallback.pages.length) {
    const historyTimeFrom = subtractCalendarDays(previousTradingDayBoundarySeconds(newerPageStart, profile, boundaryOptions), profile.windowDays)
    pages.push(createTimePage({
      index: pages.length + 1,
      limit,
      period: fallback.period,
      symbol: fallback.symbol,
      timeFrom: historyTimeFrom,
      timeTo: newerPageStart - 1,
    }))
    newerPageStart = historyTimeFrom
  }

  return {
    ...timeFallback,
    historyPageSize: limit,
    livePageSize: limit,
    pages,
    statusText: 'M5 时间分页已启用，时间边界将解析为 StoreV6 globalIndex 后显示。',
  }
}
