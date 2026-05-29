import type { MmfV2IndicatorMarker } from '../../services/mt5/mmfV2IndicatorApi'
import type { VdoIndicatorRow } from './tradingViewVdoIndicator'

export const mmfV2MomentumStatsEvent = 'fractalframe:mmf-v2-momentum-stats'
export const mmfV2MomentumCrosshairEvent = 'fractalframe:mmf-v2-momentum-crosshair'

export type MmfV2MomentumSample = {
  bars: number
  entryIndex: number
  markerIndex: number
  momentum: number
}

export type MmfV2MomentumStatsSide = {
  averageMomentum: number | null
  maxBars: number | null
  maxMomentum: number | null
  minBars: number | null
  minMomentum: number | null
  samplesList: MmfV2MomentumSample[]
  samples: number
}

export type MmfV2MomentumStats = {
  breakoutDown: MmfV2MomentumStatsSide | null
  breakoutUp: MmfV2MomentumStatsSide | null
  closeDown: MmfV2MomentumStatsSide | null
  closeUp: MmfV2MomentumStatsSide | null
  down: MmfV2MomentumStatsSide | null
  periodSeconds: number
  symbol: string
  timeframe: string
  up: MmfV2MomentumStatsSide | null
}

export function publishMmfV2MomentumStats(stats: MmfV2MomentumStats) {
  window.dispatchEvent(new CustomEvent<MmfV2MomentumStats>(mmfV2MomentumStatsEvent, { detail: stats }))
}

export function publishMmfV2MomentumCrosshairIndex(dataIndex: number | null) {
  window.dispatchEvent(new CustomEvent<{ dataIndex: number | null }>(mmfV2MomentumCrosshairEvent, { detail: { dataIndex } }))
}

export function calculateMmfV2MomentumStats({
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
  markers: MmfV2IndicatorMarker[]
  periodSeconds: number
  symbol: string
  timeframe: string
  upLookback: number
  vdoRows: VdoIndicatorRow[]
}): MmfV2MomentumStats {
  return {
    breakoutDown: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V2_SUPPORT_DOWN_BREAK', ['MMF_V2_HIGH', 'MMF_V2_RESISTANCE'], breakoutDownLookback, -1)),
    breakoutUp: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V2_RESISTANCE_UP_BREAK', ['MMF_V2_LOW', 'MMF_V2_SUPPORT'], breakoutUpLookback, 1)),
    closeDown: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V2_RESISTANCE_DOWN_BREAK', ['MMF_V2_HIGH', 'MMF_V2_RESISTANCE'], closeDownLookback, -1)),
    closeUp: summarizeMomentumSamples(createBreakoutMomentumSamples(markers, vdoRows, periodSeconds, 'MMF_V2_SUPPORT_UP_BREAK', ['MMF_V2_LOW', 'MMF_V2_SUPPORT'], closeUpLookback, 1)),
    down: summarizeMomentumSamples(createMomentumSamples(markers, vdoRows, periodSeconds, ['MMF_V2_HIGH', 'MMF_V2_RESISTANCE'], downLookback, -1)),
    periodSeconds,
    symbol,
    timeframe,
    up: summarizeMomentumSamples(createMomentumSamples(markers, vdoRows, periodSeconds, ['MMF_V2_LOW', 'MMF_V2_SUPPORT'], upLookback, 1)),
  }
}

function createBreakoutMomentumSamples(
  markers: MmfV2IndicatorMarker[],
  vdoRows: VdoIndicatorRow[],
  periodSeconds: number,
  breakType: 'MMF_V2_RESISTANCE_DOWN_BREAK' | 'MMF_V2_RESISTANCE_UP_BREAK' | 'MMF_V2_SUPPORT_DOWN_BREAK' | 'MMF_V2_SUPPORT_UP_BREAK',
  previousTypes: Array<'MMF_V2_HIGH' | 'MMF_V2_LOW' | 'MMF_V2_SUPPORT' | 'MMF_V2_RESISTANCE'>,
  lookback: number,
  direction: -1 | 1,
) {
  const safeLookback = Math.max(0, Math.round(Number(lookback)))
  if (safeLookback <= 0 || !Number.isFinite(periodSeconds) || periodSeconds <= 0) return []
  const sortedMarkers = [...markers]
    .map((marker) => ({ marker, markerIndex: Math.round(Number(marker.markerIndex ?? marker.index)) }))
    .filter((entry) => Number.isFinite(entry.markerIndex))
    .sort((left, right) => left.markerIndex - right.markerIndex)

  return sortedMarkers
    .filter((entry) => entry.marker.type === breakType)
    .map((entry): MmfV2MomentumSample | null => {
      const markerIndex = entry.markerIndex
      const previous = [...sortedMarkers]
        .reverse()
        .find((candidate) => candidate.markerIndex < markerIndex && previousTypes.includes(candidate.marker.type as 'MMF_V2_HIGH' | 'MMF_V2_LOW' | 'MMF_V2_SUPPORT' | 'MMF_V2_RESISTANCE'))
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
    .filter((sample): sample is MmfV2MomentumSample => sample != null)
    .sort((left, right) => right.entryIndex - left.entryIndex)
    .slice(0, safeLookback)
}

function createMomentumSamples(
  markers: MmfV2IndicatorMarker[],
  vdoRows: VdoIndicatorRow[],
  periodSeconds: number,
  types: Array<'MMF_V2_HIGH' | 'MMF_V2_LOW' | 'MMF_V2_SUPPORT' | 'MMF_V2_RESISTANCE'>,
  lookback: number,
  direction: -1 | 1,
) {
  const safeLookback = Math.max(0, Math.round(Number(lookback)))
  if (safeLookback <= 0 || !Number.isFinite(periodSeconds) || periodSeconds <= 0) return []

  return markers
    .filter((marker) => types.includes(marker.type as 'MMF_V2_HIGH' | 'MMF_V2_LOW' | 'MMF_V2_SUPPORT' | 'MMF_V2_RESISTANCE'))
    .map((marker): MmfV2MomentumSample | null => {
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
    .filter((sample): sample is MmfV2MomentumSample => sample != null)
    .sort((left, right) => right.entryIndex - left.entryIndex)
    .slice(0, safeLookback)
}

function summarizeMomentumSamples(samples: MmfV2MomentumSample[]): MmfV2MomentumStatsSide | null {
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
