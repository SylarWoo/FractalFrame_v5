import { createPageIdentity } from '../../pageIdentity'
import type { StoreV6PagePartition, StoreV6PagePartitionItem } from '../pagePartitionBuilder'
import {
  estimateM5TimePageLimit,
  m5TimeAlignedPartitionProfileVersion,
  m5TradingDaySlidingWeekProfile,
} from './timeAlignedPageTypes'
import {
  previousTradingDayBoundarySeconds,
  subtractCalendarDays,
} from './tradingDayBoundary'
import { resolveTimeAlignedTradingProfile } from './timeAlignedTradingProfile'
import {
  resolveM5SessionCloseBoundary,
} from './m5TradingAnchors'
import { resolveM5AnchorRuntimeContextV2 } from '../m5AnchorRuntimeContextV2'

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
    pageType: 'history',
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
      statusText: 'M5 time pagination is enabled; waiting for the latest StoreV6 K-line time.',
    }
  }

  const tradingProfile = resolveTimeAlignedTradingProfile(fallback.symbol)
  const profile = {
    ...m5TradingDaySlidingWeekProfile,
    boundaryHourShanghai: tradingProfile.boundaryHourShanghai,
    boundaryMinuteShanghai: tradingProfile.boundaryMinuteShanghai,
  }
  const boundaryOptions = { skipWeekends: tradingProfile.weekendClosed }
  const anchors = resolveM5AnchorRuntimeContextV2({
    latestTime,
    symbol: fallback.symbol,
  })
  if (anchors == null) {
    return {
      ...timeFallback,
      pages: [],
      status: 'empty',
      statusText: 'M5 time pagination is enabled, but the trading-day boundary cannot be resolved.',
    }
  }

  const limit = estimateM5TimePageLimit(profile)
  const pages: StoreV6PagePartitionItem[] = []
  let completedBoundary = anchors.completedTradingDayOpen

  while (pages.length < fallback.pages.length) {
    const timeFrom = subtractCalendarDays(completedBoundary, profile.windowDays)

    pages.push(createTimePage({
      index: pages.length + 1,
      limit,
      period: fallback.period,
      symbol: fallback.symbol,
      timeFrom,
      timeTo: resolveM5SessionCloseBoundary({
        anchorBoundary: completedBoundary,
        profile: tradingProfile,
      }) - 1,
    }))
    completedBoundary = previousTradingDayBoundarySeconds(timeFrom, profile, boundaryOptions)
  }

  return {
    ...timeFallback,
    historyPageSize: limit,
    livePageSize: limit,
    pages,
    statusText: 'M5 time pagination is enabled; each history page maps to one completed Shanghai trading week.',
  }
}
