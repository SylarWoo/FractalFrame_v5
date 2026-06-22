import { createPageIdentity } from '../../pageIdentity'
import type { StoreV6PagePartition, StoreV6PagePartitionItem } from '../pagePartitionBuilder'
import {
  estimateM30TimePageLimit,
  m30TimeAlignedPartitionProfileVersion,
  m30TradingMonthProfile,
} from './timeAlignedPageTypes'
import {
  resolveM30TradingAnchors,
} from './m30TradingAnchors'
import { subtractCalendarDays } from './tradingDayBoundary'
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
    pageType: 'history',
    plannedTimeFrom: options.timeFrom,
    plannedTimeTo: options.timeTo,
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

function estimatePageCount(totalRows: number | null | undefined, limit: number, fallbackPages: number) {
  if (typeof totalRows !== 'number' || !Number.isFinite(totalRows) || totalRows <= 0) return fallbackPages
  return Math.max(1, Math.ceil(totalRows / Math.max(1, limit)))
}

export function buildM30TradingMonthPartition(options: {
  fallback: StoreV6PagePartition
  latestTime?: number | null
}): StoreV6PagePartition {
  const { fallback } = options
  const timeFallback: StoreV6PagePartition = {
    ...fallback,
    partitionMode: 'm30-time',
    profileVersion: m30TimeAlignedPartitionProfileVersion,
  }
  if (fallback.period.trim().toUpperCase() !== 'M30') return fallback
  if (!fallback.pages.length) return timeFallback

  const latestTime = typeof options.latestTime === 'number' && Number.isFinite(options.latestTime)
    ? Math.floor(options.latestTime)
    : null
  if (latestTime == null) {
    return {
      ...timeFallback,
      pages: [],
      status: 'empty',
      statusText: 'M30 time pagination is enabled; waiting for the latest StoreV6 K-line time.',
    }
  }

  const tradingProfile = resolveTimeAlignedTradingProfile(fallback.symbol)
  const profile = {
    ...m30TradingMonthProfile,
    boundaryHourShanghai: tradingProfile.boundaryHourShanghai,
    boundaryMinuteShanghai: tradingProfile.boundaryMinuteShanghai,
  }
  const anchors = resolveM30TradingAnchors({
    latestTime,
    profile,
    symbol: fallback.symbol,
  })
  if (anchors == null) {
    return {
      ...timeFallback,
      pages: [],
      status: 'empty',
      statusText: 'M30 time pagination is enabled, but the trading-week boundary cannot be resolved.',
    }
  }

  const limit = estimateM30TimePageLimit(profile)
  const pageCount = estimatePageCount(fallback.totalRows, limit, fallback.pages.length)
  const pages: StoreV6PagePartitionItem[] = []
  let windowToExclusive = anchors.realtimeFrom

  while (pages.length < pageCount) {
    const timeFrom = subtractCalendarDays(windowToExclusive, profile.windowWeeks * 7)
    pages.push(createTimePage({
      index: pages.length + 1,
      limit,
      period: fallback.period,
      symbol: fallback.symbol,
      timeFrom,
      timeTo: windowToExclusive - 1,
    }))
    windowToExclusive = timeFrom
  }

  return {
    ...timeFallback,
    historyPageSize: limit,
    livePageSize: limit,
    pages,
    statusText: 'M30 time pagination is enabled; each history page maps to four completed Shanghai trading weeks.',
  }
}
