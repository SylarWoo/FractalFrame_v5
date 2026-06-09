import type { StoreV6PagePartition, StoreV6PagePartitionMode } from './pagePartitionBuilder'
import { buildM5TradingDaySlidingWeekPartition } from './timeAligned/m5TradingDaySlidingWeekPaginator'
import { buildM30TradingMonthPartition } from './timeAligned/m30TradingMonthPaginator'

export type StoreV6PeriodPageSystemAdapterV2 = {
  build: (options: {
    fallback: StoreV6PagePartition
    latestTime?: number | null
  }) => StoreV6PagePartition
  mode: StoreV6PagePartitionMode
  period: string
}

const periodPageSystemAdaptersV2: StoreV6PeriodPageSystemAdapterV2[] = [
  {
    build: buildM5TradingDaySlidingWeekPartition,
    mode: 'm5-time',
    period: 'M5',
  },
  {
    build: buildM30TradingMonthPartition,
    mode: 'm30-time',
    period: 'M30',
  },
]

export function normalizePageSystemPeriodV2(period: string | null | undefined) {
  return String(period ?? '').trim().toUpperCase()
}

export function resolveStoreV6PeriodPageSystemAdapterV2(period: string | null | undefined) {
  const normalized = normalizePageSystemPeriodV2(period)
  return periodPageSystemAdaptersV2.find((adapter) => adapter.period === normalized) ?? null
}

export function hasStoreV6PeriodPageSystemV2(period: string | null | undefined) {
  return resolveStoreV6PeriodPageSystemAdapterV2(period) != null
}

export function listStoreV6PeriodPageSystemPeriodsV2() {
  return periodPageSystemAdaptersV2.map((adapter) => adapter.period)
}
