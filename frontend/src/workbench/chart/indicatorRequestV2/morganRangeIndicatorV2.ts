import type { KLineData } from 'klinecharts'
import { normalizeMrSettings, type MrIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import {
  alignMorganRangeSegmentsToDisplayRows,
  calculateMorganRangeSegmentsForModeCached,
  resolveMorganRangeBucketSeconds,
  type MorganRangeSegment,
} from '../morganRangeModel'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6MorganRangeM5IndicatorIdV2 = 'MR_M5'
export const storeV6MorganRangeM5RequestIdV2 = 'MR-M5'
export const storeV6MorganRangeM5PaneIdV2 = 'main-morgan-range-m5-overlay'

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toKLineData(row: StoreV6WindowKLine): KLineData {
  return {
    close: finiteNumber(row.close),
    high: finiteNumber(row.high),
    low: finiteNumber(row.low),
    open: finiteNumber(row.open),
    timestamp: finiteNumber(row.timestamp),
    volume: finiteNumber(row.volume ?? 0),
  }
}

function normalizeRequestSettings(request: StoreV6IndicatorRequestSpecV2) {
  return normalizeMrSettings(request.params as Partial<MrIndicatorSettings> | undefined)
}

function resolveFutureBars(period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) return 0
  return Math.round(resolveMorganRangeBucketSeconds('H4_M5') / periodSeconds)
}

function resolvePeriodMs(period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  return Number.isFinite(periodSeconds) && periodSeconds > 0 ? periodSeconds * 1000 : 0
}

function resolveMaxRealtimeSegmentStartTimestamp(options: {
  activeRows: StoreV6WindowKLine[]
  historyRows: StoreV6WindowKLine[]
  period: string
}) {
  const periodMs = resolvePeriodMs(options.period)
  if (periodMs <= 0) return null
  const previousActiveRow = options.activeRows.length > 1
    ? options.activeRows[options.activeRows.length - 2]
    : null
  const lastClosedRow = previousActiveRow ?? options.historyRows[options.historyRows.length - 1] ?? null
  const timestamp = finiteNumber(lastClosedRow?.timestamp, Number.NaN)
  return Number.isFinite(timestamp) ? timestamp + periodMs : null
}

function calculateDisplaySegments(options: {
  calculationRows: StoreV6WindowKLine[]
  displayRows: StoreV6WindowKLine[]
  maxStartTimestamp?: number | null
  period: string
  requireExactStartInDisplay?: boolean
  preserveFutureExtension?: boolean
}): MorganRangeSegment[] {
  const calculationRows = options.calculationRows.map(toKLineData)
  const displayRows = options.displayRows.map(toKLineData)
  const futureBars = resolveFutureBars(options.period)
  const segments = calculateMorganRangeSegmentsForModeCached(calculationRows, 'H4_M5', futureBars)
  const exactStartTimestamps = new Set(segments.map((segment) => Number(segment.startTimestamp)))
  const aligned = alignMorganRangeSegmentsToDisplayRows({
    calculationRows,
    displayRows,
    segments,
  })
  const exactAligned = options.requireExactStartInDisplay
    ? aligned.filter((segment) => exactStartTimestamps.has(Number(segment.startTimestamp)))
    : aligned
  const gated = options.maxStartTimestamp == null
    ? exactAligned
    : exactAligned.filter((segment) => Number(segment.startTimestamp) <= Number(options.maxStartTimestamp))
  if (!options.preserveFutureExtension || futureBars <= 0) return gated
  return gated.map((segment) => ({
    ...segment,
    endIndex: Math.max(segment.endIndex, segment.startIndex + futureBars - 1),
  }))
}

function requiredWarmupRows(request: StoreV6IndicatorRequestSpecV2) {
  normalizeRequestSettings(request)
  return 8 * 48
}

export const storeV6MorganRangeM5IndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<Partial<MrIndicatorSettings>> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const rows = calculateDisplaySegments({
      calculationRows: context.calculationRows,
      displayRows: context.displayRows,
      period: context.period,
    })
    return {
      [storeV6MorganRangeM5IndicatorIdV2]: {
        displayRows: rows,
        key: `${storeV6MorganRangeM5IndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
        rows,
        settings,
        source: 'store-v6-morgan-range-m5-indicator-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const settings = normalizeRequestSettings(context.request)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const rows = calculateDisplaySegments({
      calculationRows,
      displayRows: context.activeRows,
      maxStartTimestamp: resolveMaxRealtimeSegmentStartTimestamp({
        activeRows: context.activeRows,
        historyRows: context.historyRows,
        period: context.period,
      }),
      period: context.period,
      preserveFutureExtension: true,
      requireExactStartInDisplay: true,
    })
    return {
      [storeV6MorganRangeM5IndicatorIdV2]: {
        displayRows: rows,
        key: `${storeV6MorganRangeM5IndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
        rows,
        settings,
        source: 'store-v6-morgan-range-m5-indicator-v2',
      },
    }
  },
  id: storeV6MorganRangeM5RequestIdV2,
  paneId: storeV6MorganRangeM5PaneIdV2,
  paneRole: 'main',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: requiredWarmupRows,
    mode: 'fixedRows',
    realtimeRows: requiredWarmupRows,
  },
}
