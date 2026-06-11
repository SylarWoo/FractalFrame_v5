import { createPageIdentity } from '../../pageIdentity'
import type { StoreV6PagePartition, StoreV6PagePartitionItem } from '../pagePartitionBuilder'
import {
  estimateH2TimePageLimit,
  h2TimeAlignedPartitionProfileVersion,
  h2TradingFourMonthProfile,
} from './timeAlignedPageTypes'
import { addShanghaiCalendarMonths, resolveH2TradingAnchors } from './h2TradingMonthAnchors'
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

export function buildH2TradingFourMonthPartition(options: {
  fallback: StoreV6PagePartition
  latestTime?: number | null
}): StoreV6PagePartition {
  const { fallback } = options
  const timeFallback: StoreV6PagePartition = {
    ...fallback,
    partitionMode: 'h2-time',
    profileVersion: h2TimeAlignedPartitionProfileVersion,
  }
  if (fallback.period.trim().toUpperCase() !== 'H2') return fallback
  if (!fallback.pages.length) return timeFallback

  const latestTime = typeof options.latestTime === 'number' && Number.isFinite(options.latestTime)
    ? Math.floor(options.latestTime)
    : null
  if (latestTime == null) {
    return {
      ...timeFallback,
      pages: [],
      status: 'empty',
      statusText: 'H2 time pagination is enabled; waiting for the latest StoreV6 K-line time.',
    }
  }

  const tradingProfile = resolveTimeAlignedTradingProfile(fallback.symbol)
  const profile = {
    ...h2TradingFourMonthProfile,
    boundaryHourShanghai: tradingProfile.boundaryHourShanghai,
    boundaryMinuteShanghai: tradingProfile.boundaryMinuteShanghai,
  }
  const anchors = resolveH2TradingAnchors({
    latestTime,
    profile,
  })

  const limit = estimateH2TimePageLimit(profile)
  const pageCount = estimatePageCount(fallback.totalRows, limit, fallback.pages.length)
  const pages: StoreV6PagePartitionItem[] = []
  let realtimeOpen = anchors.realtimeFrom

  while (pages.length < pageCount) {
    const timeFrom = addShanghaiCalendarMonths(realtimeOpen, -profile.historyWindowMonths, profile)
    pages.push(createTimePage({
      index: pages.length + 1,
      limit,
      period: fallback.period,
      symbol: fallback.symbol,
      timeFrom,
      timeTo: realtimeOpen - 1,
    }))
    realtimeOpen = timeFrom
  }

  return {
    ...timeFallback,
    historyPageSize: limit,
    livePageSize: limit,
    pages,
    statusText: 'H2 time pagination is enabled; each history page maps to four completed Shanghai trading months.',
  }
}
