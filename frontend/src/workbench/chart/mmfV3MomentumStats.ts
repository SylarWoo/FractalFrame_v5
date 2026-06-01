import type { MmfV3BackendMomentumSample, MmfV3IndicatorMarker } from '../../services/mt5/mmfV3IndicatorApi'
import type { VdoIndicatorRow } from './tradingViewVdoIndicator'

export const mmfV3MomentumStatsEvent = 'fractalframe:mmf-v3-momentum-stats'
export const mmfV3MomentumCrosshairEvent = 'fractalframe:mmf-v3-momentum-crosshair'

export type MmfV3MomentumSample = {
  bars: number
  direction?: string
  endIndex?: number
  entryIndex: number
  kind?: string
  markerIndex: number
  momentum: number
  previousSignalId?: string | null
  previousType?: string | null
  signalId?: string
  startIndex?: number
  type?: string
}

export type MmfV3MomentumStatsSide = {
  averageMomentum: number | null
  maxBars: number | null
  maxMomentum: number | null
  minBars: number | null
  minMomentum: number | null
  samplesList: MmfV3MomentumSample[]
  samples: number
}

export type MmfV3MomentumStats = {
  breakoutDown: MmfV3MomentumStatsSide | null
  breakoutUp: MmfV3MomentumStatsSide | null
  closeDown: MmfV3MomentumStatsSide | null
  closeUp: MmfV3MomentumStatsSide | null
  down: MmfV3MomentumStatsSide | null
  periodSeconds: number
  symbol: string
  timeframe: string
  up: MmfV3MomentumStatsSide | null
}

type PointMarkerType = 'MMF_V3_HIGH' | 'MMF_V3_LOW' | 'MMF_V3_SUPPORT' | 'MMF_V3_RESISTANCE'
type BreakMarkerType = 'MMF_V3_RESISTANCE_DOWN_BREAK' | 'MMF_V3_RESISTANCE_UP_BREAK' | 'MMF_V3_SUPPORT_DOWN_BREAK' | 'MMF_V3_SUPPORT_UP_BREAK'

export function publishMmfV3MomentumStats(stats: MmfV3MomentumStats) {
  window.dispatchEvent(new CustomEvent<MmfV3MomentumStats>(mmfV3MomentumStatsEvent, { detail: stats }))
}

export function publishMmfV3MomentumCrosshairIndex(dataIndex: number | null) {
  window.dispatchEvent(new CustomEvent<{ dataIndex: number | null }>(mmfV3MomentumCrosshairEvent, { detail: { dataIndex } }))
}

export function calculateMmfV3MomentumStats({
  breakoutDownLookback,
  breakoutUpLookback,
  closeDownLookback,
  closeUpLookback,
  downLookback,
  markers,
  periodSeconds,
  symbol,
  timeframe,
  upLookback,
  vdoRows,
}: {
  breakoutDownLookback: number
  breakoutUpLookback: number
  closeDownLookback: number
  closeUpLookback: number
  downLookback: number
  markers: MmfV3IndicatorMarker[]
  periodSeconds: number
  symbol: string
  timeframe: string
  upLookback: number
  vdoRows: VdoIndicatorRow[]
}): MmfV3MomentumStats {
  return {
    breakoutDown: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V3_SUPPORT_DOWN_BREAK', ['MMF_V3_HIGH', 'MMF_V3_RESISTANCE'], breakoutDownLookback, -1)),
    breakoutUp: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V3_RESISTANCE_UP_BREAK', ['MMF_V3_LOW', 'MMF_V3_SUPPORT'], breakoutUpLookback, 1)),
    closeDown: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V3_RESISTANCE_DOWN_BREAK', ['MMF_V3_HIGH', 'MMF_V3_RESISTANCE'], closeDownLookback, -1)),
    closeUp: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V3_SUPPORT_UP_BREAK', ['MMF_V3_LOW', 'MMF_V3_SUPPORT'], closeUpLookback, 1)),
    down: summarizeMomentumSamples(createMomentumSamples(markers, vdoRows, periodSeconds, ['MMF_V3_HIGH', 'MMF_V3_RESISTANCE'], downLookback, -1)),
    periodSeconds,
    symbol,
    timeframe,
    up: summarizeMomentumSamples(createMomentumSamples(markers, vdoRows, periodSeconds, ['MMF_V3_LOW', 'MMF_V3_SUPPORT'], upLookback, 1)),
  }
}

export function calculateMmfV3MomentumStatsFromBackendSamples({
  breakoutDownLookback,
  breakoutUpLookback,
  closeDownLookback,
  closeUpLookback,
  downLookback,
  periodSeconds,
  samples,
  symbol,
  timeframe,
  upLookback,
}: {
  breakoutDownLookback: number
  breakoutUpLookback: number
  closeDownLookback: number
  closeUpLookback: number
  downLookback: number
  periodSeconds: number
  samples: MmfV3BackendMomentumSample[]
  symbol: string
  timeframe: string
  upLookback: number
}): MmfV3MomentumStats {
  return {
    breakoutDown: summarizeMomentumSamples(createBackendMomentumSamples(samples, 'breakout', 'down', breakoutDownLookback)),
    breakoutUp: summarizeMomentumSamples(createBackendMomentumSamples(samples, 'breakout', 'up', breakoutUpLookback)),
    closeDown: summarizeMomentumSamples(createBackendMomentumSamples(samples, 'close', 'down', closeDownLookback)),
    closeUp: summarizeMomentumSamples(createBackendMomentumSamples(samples, 'close', 'up', closeUpLookback)),
    down: summarizeMomentumSamples(createBackendMomentumSamples(samples, 'high_low', 'down', downLookback)),
    periodSeconds,
    symbol,
    timeframe,
    up: summarizeMomentumSamples(createBackendMomentumSamples(samples, 'high_low', 'up', upLookback)),
  }
}

function normalizeSortedMarkers(markers: MmfV3IndicatorMarker[]) {
  return [...markers]
    .map((marker) => ({ marker, markerIndex: Math.round(Number(marker.markerIndex ?? marker.index)) }))
    .filter((entry) => Number.isFinite(entry.markerIndex))
    .sort((left, right) => left.markerIndex - right.markerIndex)
}

function createBreakoutMomentumSamples(
  markers: MmfV3IndicatorMarker[],
  vdoRows: VdoIndicatorRow[],
  periodSeconds: number,
  breakType: BreakMarkerType,
  previousTypes: PointMarkerType[],
  lookback: number,
  direction: -1 | 1,
) {
  const safeLookback = Math.max(0, Math.round(Number(lookback)))
  if (safeLookback <= 0 || !Number.isFinite(periodSeconds) || periodSeconds <= 0) return []
  const sortedMarkers = normalizeSortedMarkers(markers)

  return sortedMarkers
    .filter((entry) => entry.marker.type === breakType)
    .map((entry): MmfV3MomentumSample | null => {
      const markerIndex = entry.markerIndex
      const previous = [...sortedMarkers]
        .reverse()
        .find((candidate) => candidate.markerIndex < markerIndex && previousTypes.includes(candidate.marker.type as PointMarkerType))
      if (!previous) return null
      const startVdo = Number(vdoRows[previous.markerIndex]?.vdo)
      const endVdo = Number(vdoRows[markerIndex]?.vdo)
      const bars = markerIndex - previous.markerIndex
      const seconds = bars * periodSeconds
      if (!Number.isFinite(startVdo) || !Number.isFinite(endVdo) || bars <= 0 || seconds <= 0) return null
      const momentum = Math.abs(direction * (endVdo - startVdo)) * 1_000_000 / seconds
      if (!Number.isFinite(momentum)) return null
      return { bars, entryIndex: markerIndex, markerIndex, momentum }
    })
    .filter((sample): sample is MmfV3MomentumSample => sample != null)
    .sort((left, right) => right.entryIndex - left.entryIndex)
    .slice(0, safeLookback)
}

function createMomentumSamples(
  markers: MmfV3IndicatorMarker[],
  vdoRows: VdoIndicatorRow[],
  periodSeconds: number,
  types: PointMarkerType[],
  lookback: number,
  direction: -1 | 1,
) {
  const safeLookback = Math.max(0, Math.round(Number(lookback)))
  if (safeLookback <= 0 || !Number.isFinite(periodSeconds) || periodSeconds <= 0) return []

  return markers
    .filter((marker) => types.includes(marker.type as PointMarkerType))
    .map((marker): MmfV3MomentumSample | null => {
      const markerIndex = Math.round(Number(marker.markerIndex ?? marker.index))
      const entryIndex = Math.round(Number(marker.entryIndex))
      const startVdo = Number(vdoRows[markerIndex]?.vdo)
      const endVdo = Number(vdoRows[entryIndex]?.vdo)
      const bars = entryIndex - markerIndex
      const seconds = bars * periodSeconds
      if (!Number.isFinite(markerIndex) || !Number.isFinite(entryIndex) || !Number.isFinite(startVdo) || !Number.isFinite(endVdo) || bars <= 0 || seconds <= 0) return null
      const momentum = Math.abs(direction * (endVdo - startVdo)) * 1_000_000 / seconds
      if (!Number.isFinite(momentum)) return null
      return { bars, entryIndex, markerIndex, momentum }
    })
    .filter((sample): sample is MmfV3MomentumSample => sample != null)
    .sort((left, right) => right.entryIndex - left.entryIndex)
    .slice(0, safeLookback)
}

function createBackendMomentumSamples(
  samples: MmfV3BackendMomentumSample[],
  kind: 'breakout' | 'close' | 'high_low',
  direction: 'down' | 'up',
  lookback: number,
) {
  const safeLookback = Math.max(0, Math.round(Number(lookback)))
  if (safeLookback <= 0) return []

  return samples
    .filter((sample) => sample.kind === kind && sample.direction === direction && Number.isFinite(Number(sample.momentum)))
    .map((sample): MmfV3MomentumSample | null => {
      const startIndex = Math.round(Number(sample.startIndex))
      const endIndex = Math.round(Number(sample.endIndex))
      const entryIndex = Math.round(Number(sample.entryIndex ?? sample.endIndex))
      const markerIndex = Math.round(Number(sample.markerIndex))
      const momentum = Number(sample.momentum)
      const bars = Number.isFinite(Number(sample.bars))
        ? Math.round(Number(sample.bars))
        : Math.max(0, endIndex - startIndex)
      if (
        !Number.isFinite(startIndex) ||
        !Number.isFinite(endIndex) ||
        !Number.isFinite(entryIndex) ||
        !Number.isFinite(markerIndex) ||
        !Number.isFinite(momentum)
      ) return null
      return {
        bars,
        direction: sample.direction,
        endIndex,
        entryIndex,
        kind: sample.kind,
        markerIndex,
        momentum,
        previousSignalId: sample.previousSignalId,
        previousType: sample.previousType,
        signalId: sample.signalId,
        startIndex,
        type: sample.type,
      }
    })
    .filter((sample): sample is MmfV3MomentumSample => sample != null)
    .sort((left, right) => right.entryIndex - left.entryIndex)
    .slice(0, safeLookback)
}

function summarizeMomentumSamples(samples: MmfV3MomentumSample[]): MmfV3MomentumStatsSide | null {
  if (samples.length === 0) return null
  const bars = samples.map((sample) => sample.bars)
  const momentums = samples.map((sample) => sample.momentum)
  return {
    averageMomentum: average(momentums),
    maxBars: Math.max(...bars),
    maxMomentum: Math.max(...momentums),
    minBars: Math.min(...bars),
    minMomentum: Math.min(...momentums),
    samplesList: samples,
    samples: samples.length,
  }
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
