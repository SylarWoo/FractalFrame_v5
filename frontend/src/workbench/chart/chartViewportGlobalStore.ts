import { readJson, writeJson } from '../persistence/jsonStorage'
import type { AxisRangeSnapshot } from './chartViewportPersistence'

const viewportStoragePrefix = 'fractalframe:chartViewport:v1'
const latestViewportStorageKey = `${viewportStoragePrefix}:latest`

export type ChartViewportSnapshot = {
  barSpace: number
  dataLength: number
  offsetRightDistance: number | null
  period?: string
  rightTimestamp: number | null
  savedAt: string
  symbol?: string
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
  return normalizeChartViewportSnapshot(snapshot)
}

export function readLatestChartViewportSnapshot(): ChartViewportSnapshot | null {
  const snapshot = readJson<Partial<ChartViewportSnapshot> | null>(latestViewportStorageKey, null)
  return normalizeChartViewportSnapshot(snapshot)
}

function normalizeChartViewportSnapshot(snapshot: Partial<ChartViewportSnapshot> | null) {
  if (!snapshot || !finiteNumber(snapshot.barSpace) || !finiteNumber(snapshot.visibleTo)) return null
  return {
    barSpace: Math.max(1, Math.min(snapshot.barSpace, 80)),
    dataLength: finiteNumber(snapshot.dataLength) ? snapshot.dataLength : 0,
    offsetRightDistance: finiteNumber(snapshot.offsetRightDistance) ? snapshot.offsetRightDistance : null,
    period: typeof snapshot.period === 'string' ? snapshot.period : undefined,
    rightTimestamp: finiteNumber(snapshot.rightTimestamp) ? snapshot.rightTimestamp : null,
    savedAt: typeof snapshot.savedAt === 'string' ? snapshot.savedAt : '',
    symbol: typeof snapshot.symbol === 'string' ? snapshot.symbol : undefined,
    visibleTo: snapshot.visibleTo,
    yAxisRange: normalizeAxisRange(snapshot.yAxisRange),
  }
}

export function writeGlobalChartViewportSnapshot(period: string, snapshot: ChartViewportSnapshot) {
  const nextSnapshot = { ...snapshot, period: period.toUpperCase() }
  writeJson(viewportStorageKey(period), nextSnapshot)
  writeJson(latestViewportStorageKey, nextSnapshot)
}
