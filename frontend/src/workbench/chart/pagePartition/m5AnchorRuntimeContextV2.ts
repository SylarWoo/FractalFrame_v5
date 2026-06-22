import {
  m5TimeAlignedPartitionProfileVersion,
  m5TradingDaySlidingWeekProfile,
} from './timeAligned/timeAlignedPageTypes'
import {
  resolveM5RealtimeOpenFromHistoryClose,
  resolveM5TradingAnchors,
  type M5TradingAnchorSet,
} from './timeAligned/m5TradingAnchors'
import type { StoreV6PagePartitionItem } from './pagePartitionBuilder'

export type M5AnchorRuntimeContextV2 = M5TradingAnchorSet & {
  latestTime: number
  profileVersion: number
  symbol: string
}

export type M5AnchorRuntimeCacheMetaV2 = {
  historyFrom: number
  historyTo: number
  realtimeFrom: number
}

export function resolveM5AnchorRuntimeContextV2(options: {
  latestTime: number | null | undefined
  symbol: string | null | undefined
}): M5AnchorRuntimeContextV2 | null {
  if (typeof options.latestTime !== 'number' || !Number.isFinite(options.latestTime)) return null
  const symbol = String(options.symbol ?? '').trim()
  const anchors = resolveM5TradingAnchors({
    latestTime: Math.floor(options.latestTime),
    profile: m5TradingDaySlidingWeekProfile,
    symbol,
  })
  if (!anchors) return null
  return {
    ...anchors,
    latestTime: Math.floor(options.latestTime),
    profileVersion: m5TimeAlignedPartitionProfileVersion,
    symbol,
  }
}

export function resolveM5AnchorRuntimeContextFromPagesV2(options: {
  pages: StoreV6PagePartitionItem[] | null | undefined
  symbol: string | null | undefined
}): M5AnchorRuntimeCacheMetaV2 | null {
  const page = options.pages?.[0]
  const historyFrom = typeof page?.plannedTimeFrom === 'number' ? page.plannedTimeFrom : page?.timeFrom
  const historyTo = typeof page?.plannedTimeTo === 'number' ? page.plannedTimeTo : page?.timeTo
  if (typeof historyFrom !== 'number' || typeof historyTo !== 'number') return null
  const realtimeFrom = resolveM5RealtimeOpenFromHistoryClose({
    historyTo,
    profile: m5TradingDaySlidingWeekProfile,
    symbol: options.symbol,
  })
  if (typeof realtimeFrom !== 'number' || !Number.isFinite(realtimeFrom)) return null
  return {
    historyFrom,
    historyTo,
    realtimeFrom,
  }
}

export function m5AnchorRuntimeCacheMetaEqualsV2(
  left: M5AnchorRuntimeCacheMetaV2 | null | undefined,
  right: M5AnchorRuntimeCacheMetaV2 | null | undefined,
) {
  return Boolean(
    left &&
    right &&
    left.historyFrom === right.historyFrom &&
    left.historyTo === right.historyTo &&
    left.realtimeFrom === right.realtimeFrom,
  )
}
