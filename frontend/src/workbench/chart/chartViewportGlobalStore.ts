import { readJson, writeJson } from '../persistence/jsonStorage'
import type { AxisRangeSnapshot } from './chartViewportPersistence'

const viewportStoragePrefix = 'fractalframe:chartViewport:v1'

export type ChartViewportSnapshot = {
  barSpace: number
  dataLength: number
  offsetRightDistance: number | null
  rightTimestamp: number | null
  savedAt: string
  visibleTo: number
  yAxisRange: AxisRangeSnapshot | null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function viewportStorageKey(period: string) {
  return `${viewportStoragePrefix}:global:${period.toUpperCase()}`
}

function normalizeAxisRange(range: Partial<AxisRangeSnapshot> | null | undefined): AxisRangeSnapshot | null {
  if (!range) return null
  if (!finiteNumber(range.from) || !finiteNumber(range.to) || !finiteNumber(range.range)) return null
  if (!finiteNumber(range.realFrom) || !finiteNumber(range.realTo) || !finiteNumber(range.realRange)) return null
  if (range.range <= 0 || range.realRange <= 0) return null
  return {
    from: range.from,
    range: range.range,
    realFrom: range.realFrom,
    realRange: range.realRange,
    realTo: range.realTo,
    to: range.to,
  }
}

export function readGlobalChartViewportSnapshot(period: string): ChartViewportSnapshot | null {
  const snapshot = readJson<Partial<ChartViewportSnapshot> | null>(viewportStorageKey(period), null)
  if (!snapshot || !finiteNumber(snapshot.barSpace) || !finiteNumber(snapshot.visibleTo)) return null
  return {
    barSpace: Math.max(1, Math.min(snapshot.barSpace, 80)),
    dataLength: finiteNumber(snapshot.dataLength) ? snapshot.dataLength : 0,
    offsetRightDistance: finiteNumber(snapshot.offsetRightDistance) ? snapshot.offsetRightDistance : null,
    rightTimestamp: finiteNumber(snapshot.rightTimestamp) ? snapshot.rightTimestamp : null,
    savedAt: typeof snapshot.savedAt === 'string' ? snapshot.savedAt : '',
    visibleTo: snapshot.visibleTo,
    yAxisRange: normalizeAxisRange(snapshot.yAxisRange),
  }
}

export function writeGlobalChartViewportSnapshot(period: string, snapshot: ChartViewportSnapshot) {
  writeJson(viewportStorageKey(period), snapshot)
}
