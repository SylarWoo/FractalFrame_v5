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
  downLookback,
  markers,
  periodSeconds,
  symbol,
  timeframe,
  upLookback,
  vdoRows,
}: {
  downLookback: number
  markers: MmfV2IndicatorMarker[]
  periodSeconds: number
  symbol: string
  timeframe: string
  upLookback: number
  vdoRows: VdoIndicatorRow[]
}): MmfV2MomentumStats {
  return {
    down: summarizeMomentumSamples(createMomentumSamples(markers, vdoRows, periodSeconds, ['MMF_V2_HIGH', 'MMF_V2_RESISTANCE'], downLookback, -1)),
    periodSeconds,
    symbol,
    timeframe,
    up: summarizeMomentumSamples(createMomentumSamples(markers, vdoRows, periodSeconds, ['MMF_V2_LOW', 'MMF_V2_SUPPORT'], upLookback, 1)),
  }
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
