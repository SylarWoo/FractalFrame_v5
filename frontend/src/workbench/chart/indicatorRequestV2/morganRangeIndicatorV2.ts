import type { KLineData } from 'klinecharts'
import { normalizeMrSettings, type MrIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import {
  alignMorganRangeSegmentsToDisplayRows,
  calculateMorganRangeSegmentsForModeCached,
  resolveMorganRangeBucketSeconds,
  type MorganRangeMode,
  type MorganRangeSegment,
} from '../morganRangeModel'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'

export const storeV6MorganRangeM5IndicatorIdV2 = 'MR_M5'
export const storeV6MorganRangeM5RequestIdV2 = 'MR-M5'
export const storeV6MorganRangeM5PaneIdV2 = 'main-morgan-range-m5-overlay'
export const storeV6MorganRangeM30IndicatorIdV2 = 'MR_M30'
export const storeV6MorganRangeM30RequestIdV2 = 'MR-M30'
export const storeV6MorganRangeM30PaneIdV2 = 'main-morgan-range-m30-overlay'
export const storeV6MorganRangeH2IndicatorIdV2 = 'MR_H2'
export const storeV6MorganRangeH2RequestIdV2 = 'MR-H2'
export const storeV6MorganRangeH2PaneIdV2 = 'main-morgan-range-h2-overlay'

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

function resolveFutureBars(period: string, mode: MorganRangeMode) {
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) return 0
  return Math.round(resolveMorganRangeBucketSeconds(mode) / periodSeconds)
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
  const lastClosedRow = options.activeRows[options.activeRows.length - 1] ?? options.historyRows[options.historyRows.length - 1] ?? null
  const timestamp = finiteNumber(lastClosedRow?.timestamp, Number.NaN)
  return Number.isFinite(timestamp) ? timestamp + periodMs : null
}

function calculateDisplaySegments(options: {
  calculationRows: StoreV6WindowKLine[]
  displayRows: StoreV6WindowKLine[]
  maxStartTimestamp?: number | null
  mode: MorganRangeMode
  period: string
  requireExactStartInDisplay?: boolean
  preserveFutureExtension?: boolean
}): MorganRangeSegment[] {
  const calculationRows = options.calculationRows.map(toKLineData)
  const displayRows = options.displayRows.map(toKLineData)
  const futureBars = options.preserveFutureExtension ? resolveFutureBars(options.period, options.mode) : 0
  const segments = calculateMorganRangeSegmentsForModeCached(calculationRows, options.mode, futureBars)
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
    endTimestamp: undefined,
    endIndex: Math.max(segment.endIndex, segment.startIndex + futureBars - 1),
  }))
}

function requiredWarmupRows(request: StoreV6IndicatorRequestSpecV2, mode: MorganRangeMode) {
  normalizeRequestSettings(request)
  return mode === 'D5_H2' ? 8 * 60 : 8 * 48
}

function createMorganRangeIndicatorDefinitionV2(options: {
  indicatorId: string
  mode: MorganRangeMode
  paneId: string
  requestId: string
  source: string
}): StoreV6IndicatorDefinitionV2<Partial<MrIndicatorSettings>> {
  return {
    calculationMode: 'computed',
    calculateHistory: (context) => {
      const settings = normalizeRequestSettings(context.request)
      const rows = calculateDisplaySegments({
        calculationRows: context.calculationRows,
        displayRows: context.displayRows,
        mode: options.mode,
        period: context.period,
      })
      return {
        [options.indicatorId]: {
          displayRows: rows,
          key: `${options.indicatorId}:history:${context.symbol}:${context.period}:${context.pageIndex}`,
          rows,
          settings,
          source: options.source,
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
        mode: options.mode,
        period: context.period,
        preserveFutureExtension: true,
        requireExactStartInDisplay: true,
      })
      return {
        [options.indicatorId]: {
          displayRows: rows,
          key: `${options.indicatorId}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}`,
          rows,
          settings,
          source: options.source,
        },
      }
    },
    id: options.requestId,
    paneId: options.paneId,
    paneRole: 'main',
    realtimeUpdateMode: 'window',
    renderRole: 'main-overlay',
    warmup: {
      historyRows: (request) => requiredWarmupRows(request, options.mode),
      mode: 'fixedRows',
      realtimeRows: (request) => requiredWarmupRows(request, options.mode),
    },
  }
}

export const storeV6MorganRangeM5IndicatorDefinitionV2 = createMorganRangeIndicatorDefinitionV2({
  indicatorId: storeV6MorganRangeM5IndicatorIdV2,
  mode: 'H4_M5',
  paneId: storeV6MorganRangeM5PaneIdV2,
  requestId: storeV6MorganRangeM5RequestIdV2,
  source: 'store-v6-morgan-range-m5-indicator-v2',
})

export const storeV6MorganRangeM30IndicatorDefinitionV2 = createMorganRangeIndicatorDefinitionV2({
  indicatorId: storeV6MorganRangeM30IndicatorIdV2,
  mode: 'D1_M30',
  paneId: storeV6MorganRangeM30PaneIdV2,
  requestId: storeV6MorganRangeM30RequestIdV2,
  source: 'store-v6-morgan-range-m30-indicator-v2',
})

export const storeV6MorganRangeH2IndicatorDefinitionV2 = createMorganRangeIndicatorDefinitionV2({
  indicatorId: storeV6MorganRangeH2IndicatorIdV2,
  mode: 'D5_H2',
  paneId: storeV6MorganRangeH2PaneIdV2,
  requestId: storeV6MorganRangeH2RequestIdV2,
  source: 'store-v6-morgan-range-h2-indicator-v2',
})
