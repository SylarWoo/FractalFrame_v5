import type { KLineChartPaneFrame } from './historyPageKLineChartFrameV2'
import type { IndicatorPageSnapshot } from './indicatorPageSnapshotStore'
import {
  storeV6MorganRangeH2IndicatorIdV2,
  storeV6MorganRangeH2RequestIdV2,
  storeV6MorganRangeM30IndicatorIdV2,
  storeV6MorganRangeM30RequestIdV2,
  storeV6MorganRangeM5IndicatorIdV2,
  storeV6MorganRangeM5RequestIdV2,
} from './indicatorRequestV2/morganRangeIndicatorV2'
import type { KLineChartRenderFrameV2 } from './klineChartRenderFrameV2'
import {
  findMorganRangeSegmentByDataIndex,
  getMorganRangeLevel,
  type MorganRangeMode,
  type MorganRangeSegment,
} from './morganRangeModel'

export type MorganRangeRuntimeIndicatorId =
  | typeof storeV6MorganRangeM5IndicatorIdV2
  | typeof storeV6MorganRangeM30IndicatorIdV2
  | typeof storeV6MorganRangeH2IndicatorIdV2

export type MorganRangeRuntimeRequestId =
  | typeof storeV6MorganRangeM5RequestIdV2
  | typeof storeV6MorganRangeM30RequestIdV2
  | typeof storeV6MorganRangeH2RequestIdV2

export type MorganRangeRuntimeDefinitionV2 = {
  aliases: string[]
  indicatorId: MorganRangeRuntimeIndicatorId
  mode: MorganRangeMode
  period: 'H2' | 'M30' | 'M5'
  requestId: MorganRangeRuntimeRequestId
}

export type MorganRangeRuntimeDataV2 = MorganRangeRuntimeDefinitionV2 & {
  core: {
    lower: number
    lowerRatio: -0.236
    trueRange: number
    upper: number
    upperRatio: 0.236
  }
  dataIndex: number
  levelsByRatio: Record<string, number>
  segment: MorganRangeSegment
  segments: MorganRangeSegment[]
  symbol?: string
}

export const morganRangeRuntimeDefinitionsV2: MorganRangeRuntimeDefinitionV2[] = [
  {
    aliases: [storeV6MorganRangeM5RequestIdV2, 'MR_M5', 'MR-M5'],
    indicatorId: storeV6MorganRangeM5IndicatorIdV2,
    mode: 'H4_M5',
    period: 'M5',
    requestId: storeV6MorganRangeM5RequestIdV2,
  },
  {
    aliases: [storeV6MorganRangeM30RequestIdV2, 'MR_M30', 'MR-M30'],
    indicatorId: storeV6MorganRangeM30IndicatorIdV2,
    mode: 'D1_M30',
    period: 'M30',
    requestId: storeV6MorganRangeM30RequestIdV2,
  },
  {
    aliases: [storeV6MorganRangeH2RequestIdV2, 'MR_H2', 'MR-H2'],
    indicatorId: storeV6MorganRangeH2IndicatorIdV2,
    mode: 'D5_H2',
    period: 'H2',
    requestId: storeV6MorganRangeH2RequestIdV2,
  },
]

export function isMorganRangeSegmentV2(row: unknown): row is MorganRangeSegment {
  if (!row || typeof row !== 'object') return false
  const segment = row as Partial<MorganRangeSegment>
  return Number.isFinite(segment.startIndex) &&
    Number.isFinite(segment.endIndex) &&
    Number.isFinite(segment.startTimestamp) &&
    Number.isFinite(segment.center) &&
    Number.isFinite(segment.upper) &&
    Number.isFinite(segment.lower) &&
    Number.isFinite(segment.range)
}

export function resolveMorganRangeRuntimeDefinitionV2(input: {
  indicatorId?: string | null
  mode?: MorganRangeMode | null
  period?: string | null
  requestId?: string | null
}) {
  const indicatorId = input.indicatorId?.trim()
  const requestId = input.requestId?.trim()
  const period = input.period?.trim().toUpperCase()
  return morganRangeRuntimeDefinitionsV2.find((definition) => (
    definition.indicatorId === indicatorId ||
    definition.requestId === requestId ||
    definition.mode === input.mode ||
    definition.period === period ||
    definition.aliases.includes(indicatorId ?? '') ||
    definition.aliases.includes(requestId ?? '')
  )) ?? null
}

export function resolveMorganRangeRuntimeDefinitionForFrameV2(frame: KLineChartRenderFrameV2, preferredId?: string | null) {
  const preferred = resolveMorganRangeRuntimeDefinitionV2({
    indicatorId: preferredId,
    period: frame.period,
    requestId: preferredId,
  })
  if (preferred && readMorganRangePaneFromFrameV2(frame, preferred)) return preferred
  return morganRangeRuntimeDefinitionsV2.find((definition) => (
    definition.period === frame.period.trim().toUpperCase() &&
    readMorganRangePaneFromFrameV2(frame, definition)
  )) ?? morganRangeRuntimeDefinitionsV2.find((definition) => readMorganRangePaneFromFrameV2(frame, definition)) ?? null
}

export function readMorganRangePaneFromFrameV2(
  frame: KLineChartRenderFrameV2,
  definition: MorganRangeRuntimeDefinitionV2,
): KLineChartPaneFrame | null {
  return definition.aliases.reduce<KLineChartPaneFrame | null>((pane, key) => (
    pane ?? frame.panes[key] ?? null
  ), null)
}

export function readMorganRangeSegmentsFromFrameV2(
  frame: KLineChartRenderFrameV2,
  preferredId?: string | null,
) {
  const definition = resolveMorganRangeRuntimeDefinitionForFrameV2(frame, preferredId)
  if (!definition) return null
  const pane = readMorganRangePaneFromFrameV2(frame, definition)
  const segments = (pane?.rows ?? []).filter(isMorganRangeSegmentV2)
  return {
    definition,
    pane,
    segments,
  }
}

export function createMorganRangeRuntimeDataV2(options: {
  dataIndex: number
  definition: MorganRangeRuntimeDefinitionV2
  segment: MorganRangeSegment | null | undefined
  segments: MorganRangeSegment[]
  symbol?: string
}): MorganRangeRuntimeDataV2 | null {
  const segment = options.segment
  if (!segment) return null
  const lowerCore = getMorganRangeLevel(segment, -0.236)
  const upperCore = getMorganRangeLevel(segment, 0.236)
  const lower = Number(lowerCore?.price)
  const upper = Number(upperCore?.price)
  const levelsByRatio: Record<string, number> = {}
  segment.levels.forEach((level) => {
    levelsByRatio[Number(level.ratio).toFixed(3)] = Number(level.price)
  })
  return {
    ...options.definition,
    core: {
      lower,
      lowerRatio: -0.236,
      trueRange: Number.isFinite(upper) && Number.isFinite(lower) ? upper - lower : Number(segment.trueRange),
      upper,
      upperRatio: 0.236,
    },
    dataIndex: options.dataIndex,
    levelsByRatio,
    segment,
    segments: options.segments,
    symbol: options.symbol,
  }
}

export function readCurrentMorganRangeDataFromFrameV2(
  frame: KLineChartRenderFrameV2,
  options: {
    dataIndex?: number | null
    indicatorId?: string | null
  } = {},
) {
  const source = readMorganRangeSegmentsFromFrameV2(frame, options.indicatorId)
  if (!source || source.segments.length === 0) return null
  const fallbackIndex = Math.max(0, frame.mainRows.length - 1)
  const dataIndex = Number.isFinite(Number(options.dataIndex)) ? Math.round(Number(options.dataIndex)) : fallbackIndex
  const segment = findMorganRangeSegmentByDataIndex(source.segments, dataIndex) ?? source.segments[source.segments.length - 1] ?? null
  return createMorganRangeRuntimeDataV2({
    dataIndex,
    definition: source.definition,
    segment,
    segments: source.segments,
    symbol: frame.symbol,
  })
}

export function readCurrentMorganRangeDataFromSnapshotV2(
  snapshot: IndicatorPageSnapshot | null | undefined,
  options: {
    dataIndex?: number | null
    indicatorId?: string | null
  } = {},
) {
  if (!snapshot?.morganRange?.segments.length) return null
  const definition = resolveMorganRangeRuntimeDefinitionV2({
    indicatorId: options.indicatorId,
    mode: snapshot.morganRange.mode,
    period: snapshot.period,
    requestId: options.indicatorId,
  })
  if (!definition) return null
  const segments = snapshot.morganRange.segments.filter(isMorganRangeSegmentV2)
  if (!segments.length) return null
  const fallbackIndex = Math.max(0, snapshot.rows.length - 1)
  const dataIndex = Number.isFinite(Number(options.dataIndex)) ? Math.round(Number(options.dataIndex)) : fallbackIndex
  const segment = findMorganRangeSegmentByDataIndex(segments, dataIndex) ?? segments[segments.length - 1] ?? null
  return createMorganRangeRuntimeDataV2({
    dataIndex,
    definition,
    segment,
    segments,
    symbol: snapshot.symbol,
  })
}
