import type { MmfV2IndicatorMarker } from '../../services/mt5/mmfV2IndicatorApi'
import type { StochIndicatorRow } from './tradingViewStochIndicator'
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

export type MmfV2RangeDistanceStats = {
  averageDistance: number | null
  endTime: number | null
  maxDistance: number | null
  minDistance: number | null
  samples: number
  startTime: number | null
  strongMomentumPoints: number
}

export type MmfV2ArbitrageBacktestStats = {
  balance: number
  expectedValue: number | null
  losses: number
  samples: number
  winRate: number | null
  wins: number
}

export type MmfV2MomentumStats = {
  arbitrageDownClose: MmfV2RangeDistanceStats | null
  arbitrageLongBacktest: MmfV2ArbitrageBacktestStats
  arbitrageShortBacktest: MmfV2ArbitrageBacktestStats
  arbitrageUpClose: MmfV2RangeDistanceStats | null
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
  arbitrageLongEntryMomentum,
  arbitrageLongCloseMode,
  arbitrageLongPosition,
  arbitrageLongStopLoss,
  arbitrageLongStochExitThreshold,
  arbitrageLongTakeProfit,
  arbitrageShortEntryMomentum,
  arbitrageShortCloseMode,
  arbitrageShortPosition,
  arbitrageShortStopLoss,
  arbitrageShortStochExitThreshold,
  arbitrageShortTakeProfit,
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
  rows,
  stochRows,
  vdoRows,
}: {
  arbitrageLongEntryMomentum: number
  arbitrageLongCloseMode: 'point' | 'stoch' | 'target'
  arbitrageLongPosition: number
  arbitrageLongStopLoss: number
  arbitrageLongStochExitThreshold: number
  arbitrageLongTakeProfit: number
  arbitrageShortEntryMomentum: number
  arbitrageShortCloseMode: 'point' | 'stoch' | 'target'
  arbitrageShortPosition: number
  arbitrageShortStopLoss: number
  arbitrageShortStochExitThreshold: number
  arbitrageShortTakeProfit: number
  breakoutDownLookback: number
  breakoutUpLookback: number
  closeDownLookback: number
  closeUpLookback: number
  downLookback: number
  markers: MmfV2IndicatorMarker[]
  periodSeconds: number
  rows: Array<{ close?: number; high?: number; low?: number }>
  stochRows: StochIndicatorRow[]
  symbol: string
  timeframe: string
  upLookback: number
  vdoRows: VdoIndicatorRow[]
}): MmfV2MomentumStats {
  const arbitrageBacktests = calculateArbitrageBacktests({
    longCloseMode: arbitrageLongCloseMode,
    longEntryMomentumThreshold: arbitrageLongEntryMomentum,
    longPosition: arbitrageLongPosition,
    longStopLossDistance: arbitrageLongStopLoss,
    longStochExitThreshold: arbitrageLongStochExitThreshold,
    longTakeProfitDistance: arbitrageLongTakeProfit,
    markers,
    periodSeconds,
    rows,
    stochRows,
    shortCloseMode: arbitrageShortCloseMode,
    shortEntryMomentumThreshold: arbitrageShortEntryMomentum,
    shortPosition: arbitrageShortPosition,
    shortStopLossDistance: arbitrageShortStopLoss,
    shortStochExitThreshold: arbitrageShortStochExitThreshold,
    shortTakeProfitDistance: arbitrageShortTakeProfit,
    vdoRows,
  })
  return {
    arbitrageDownClose: summarizeRangeDistances(createClosedTrendRangeDistances(markers, vdoRows, periodSeconds, 'MMF_V2_SUPPORT_UP_BREAK')),
    arbitrageLongBacktest: arbitrageBacktests.long,
    arbitrageShortBacktest: arbitrageBacktests.short,
    arbitrageUpClose: summarizeRangeDistances(createClosedTrendRangeDistances(markers, vdoRows, periodSeconds, 'MMF_V2_RESISTANCE_DOWN_BREAK')),
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

function calculateArbitrageBacktests({
  longCloseMode,
  longEntryMomentumThreshold,
  longPosition,
  longStopLossDistance,
  longStochExitThreshold,
  longTakeProfitDistance,
  markers,
  periodSeconds,
  rows,
  stochRows,
  shortCloseMode,
  shortEntryMomentumThreshold,
  shortPosition,
  shortStopLossDistance,
  shortStochExitThreshold,
  shortTakeProfitDistance,
  vdoRows,
}: {
  longCloseMode: 'point' | 'stoch' | 'target'
  longEntryMomentumThreshold: number
  longPosition: number
  longStopLossDistance: number
  longStochExitThreshold: number
  longTakeProfitDistance: number
  markers: MmfV2IndicatorMarker[]
  periodSeconds: number
  rows: Array<{ close?: number; high?: number; low?: number }>
  shortCloseMode: 'point' | 'stoch' | 'target'
  shortEntryMomentumThreshold: number
  shortPosition: number
  shortStopLossDistance: number
  shortStochExitThreshold: number
  shortTakeProfitDistance: number
  stochRows: StochIndicatorRow[]
  vdoRows: VdoIndicatorRow[]
}) {
  const configs = {
    long: normalizeBacktestConfig(longEntryMomentumThreshold, longTakeProfitDistance, longStopLossDistance, longPosition, longCloseMode, longStochExitThreshold),
    short: normalizeBacktestConfig(shortEntryMomentumThreshold, shortTakeProfitDistance, shortStopLossDistance, shortPosition, shortCloseMode, shortStochExitThreshold),
  }
  const sortedMarkers = normalizeSortedMarkers(markers)
  const endTypes = new Set<MmfV2IndicatorMarker['type']>(['MMF_V2_RESISTANCE_UP_BREAK', 'MMF_V2_SUPPORT_DOWN_BREAK'])
  const totals = {
    long: { losses: 0, lossValue: 0, profitValue: 0, wins: 0 },
    short: { losses: 0, lossValue: 0, profitValue: 0, wins: 0 },
  }

  sortedMarkers.forEach((start, startOffset) => {
    if (start.marker.type !== 'MMF_V2_RESISTANCE_DOWN_BREAK' && start.marker.type !== 'MMF_V2_SUPPORT_UP_BREAK') return
    const end = sortedMarkers
      .slice(startOffset + 1)
      .find((entry) => endTypes.has(entry.marker.type))
    const endIndex = end?.markerIndex ?? rows.length - 1
    let expectedDirection: 'long' | 'short' = start.marker.type === 'MMF_V2_SUPPORT_UP_BREAK' ? 'short' : 'long'
    const candidates = sortedMarkers
      .slice(startOffset + 1)
      .filter((entry) => entry.markerIndex < endIndex)

    candidates.forEach((candidate) => {
      const side = resolveRangePointSide(candidate.marker.type)
      if (!side) return
      const direction = side === 'high' ? 'short' : 'long'
      if (direction !== expectedDirection) return
      const config = configs[direction]
      if (!config) return
      if (!hasRequiredStructureAtOrBefore(sortedMarkers, startOffset, candidate.markerIndex, direction)) return
      const pointSide = direction === 'short' ? 'high' : 'low'
      const momentum = calculatePointMomentum(candidate.marker, vdoRows, periodSeconds, pointSide)
      if (momentum == null || momentum < config.entryMomentumThreshold) return
      const entryIndex = Math.round(Number(candidate.marker.entryIndex))
      const entryPrice = Number(candidate.marker.entryPrice ?? candidate.marker.price)
      if (!Number.isFinite(entryIndex) || entryIndex <= candidate.markerIndex || entryIndex >= endIndex || !Number.isFinite(entryPrice)) return
      const outcome = resolveTradeOutcome({
        direction,
        endIndex,
        entryIndex,
        entryPrice,
        markers: sortedMarkers,
        rows,
        stochRows,
        closeMode: config.closeMode,
        stopLossDistance: config.stopLossDistance,
        stochExitThreshold: config.stochExitThreshold,
        takeProfitDistance: config.takeProfitDistance,
      })
      if (outcome?.result === 'win') {
        totals[direction].wins += 1
        totals[direction].profitValue += outcome.value
      }
      if (outcome?.result === 'loss') {
        totals[direction].losses += 1
        totals[direction].lossValue += outcome.value
      }
      if (outcome) expectedDirection = direction === 'short' ? 'long' : 'short'
    })
  })

  return {
    long: summarizeBacktestTotals(totals.long, configs.long),
    short: summarizeBacktestTotals(totals.short, configs.short),
  }
}

function normalizeBacktestConfig(
  entryMomentumThreshold: number,
  takeProfitDistance: number,
  stopLossDistance: number,
  position: number,
  closeMode: 'point' | 'stoch' | 'target',
  stochExitThreshold: number,
) {
  const safeEntryMomentum = Number(entryMomentumThreshold)
  const safeTakeProfit = Number(takeProfitDistance)
  const safeStopLoss = Number(stopLossDistance)
  const safePosition = Number(position)
  const safeStochExitThreshold = Number(stochExitThreshold)
  if (!Number.isFinite(safeEntryMomentum) || !Number.isFinite(safeStopLoss) || safeStopLoss <= 0) return null
  if (closeMode === 'target' && (!Number.isFinite(safeTakeProfit) || safeTakeProfit <= 0)) return null
  if (closeMode === 'stoch' && !Number.isFinite(safeStochExitThreshold)) return null
  return {
    closeMode,
    entryMomentumThreshold: safeEntryMomentum,
    positionMultiplier: Number.isFinite(safePosition) && safePosition > 0 ? safePosition / 0.01 : 1,
    stopLossDistance: safeStopLoss,
    stochExitThreshold: safeStochExitThreshold,
    takeProfitDistance: Number.isFinite(safeTakeProfit) ? safeTakeProfit : 0,
  }
}

function summarizeBacktestTotals(totals: { losses: number; lossValue: number; profitValue: number; wins: number }, config: ReturnType<typeof normalizeBacktestConfig>): MmfV2ArbitrageBacktestStats {
  if (!config) return { balance: 0, expectedValue: null, losses: 0, samples: 0, winRate: null, wins: 0 }
  const { losses, lossValue, profitValue, wins } = totals
  const samples = wins + losses
  const balance = profitValue * config.positionMultiplier - lossValue * config.positionMultiplier
  return {
    balance,
    expectedValue: samples > 0 ? balance / samples : null,
    losses,
    samples,
    winRate: samples > 0 ? wins / samples : null,
    wins,
  }
}

function hasRequiredStructureAtOrBefore(
  sortedMarkers: Array<{ marker: MmfV2IndicatorMarker; markerIndex: number }>,
  startOffset: number,
  candidateIndex: number,
  direction: 'long' | 'short',
) {
  const requiredTypes = direction === 'short'
    ? new Set<MmfV2IndicatorMarker['type']>(['MMF_V2_EXPECTED_RESISTANCE', 'MMF_V2_RESISTANCE'])
    : new Set<MmfV2IndicatorMarker['type']>(['MMF_V2_EXPECTED_SUPPORT', 'MMF_V2_SUPPORT'])
  return sortedMarkers
    .slice(startOffset + 1)
    .some((entry) => entry.markerIndex <= candidateIndex && requiredTypes.has(entry.marker.type))
}

function resolveTradeOutcome({
  direction,
  endIndex,
  entryIndex,
  entryPrice,
  markers,
  rows,
  closeMode,
  stopLossDistance,
  stochExitThreshold,
  stochRows,
  takeProfitDistance,
}: {
  closeMode: 'point' | 'stoch' | 'target'
  direction: 'long' | 'short'
  endIndex: number
  entryIndex: number
  entryPrice: number
  markers: Array<{ marker: MmfV2IndicatorMarker; markerIndex: number }>
  rows: Array<{ close?: number; high?: number; low?: number }>
  stopLossDistance: number
  stochExitThreshold: number
  stochRows: StochIndicatorRow[]
  takeProfitDistance: number
}) {
  const takeProfit = direction === 'long' ? entryPrice + takeProfitDistance : entryPrice - takeProfitDistance
  const stopLoss = direction === 'long' ? entryPrice - stopLossDistance : entryPrice + stopLossDistance
  for (let index = entryIndex + 1; index <= Math.min(endIndex, rows.length - 1); index += 1) {
    const high = Number(rows[index]?.high)
    const low = Number(rows[index]?.low)
    if (!Number.isFinite(high) || !Number.isFinite(low)) continue
    if (direction === 'long') {
      if (low <= stopLoss) return { result: 'loss' as const, value: stopLossDistance }
      if (closeMode === 'target' && takeProfitDistance > 0 && high >= takeProfit) return { result: 'win' as const, value: takeProfitDistance }
    } else {
      if (high >= stopLoss) return { result: 'loss' as const, value: stopLossDistance }
      if (closeMode === 'target' && takeProfitDistance > 0 && low <= takeProfit) return { result: 'win' as const, value: takeProfitDistance }
    }
    if (closeMode === 'point') {
      const pointExit = resolvePointExitPrice(markers, direction, entryIndex, index)
      if (pointExit != null) return resolveExitResult(direction, entryPrice, pointExit)
    }
    if (closeMode === 'stoch' && isStochExitCross(stochRows, direction, index, stochExitThreshold)) {
      const close = Number(rows[index]?.close)
      if (Number.isFinite(close)) return resolveExitResult(direction, entryPrice, close)
    }
  }
  return null
}

function resolvePointExitPrice(
  markers: Array<{ marker: MmfV2IndicatorMarker; markerIndex: number }>,
  direction: 'long' | 'short',
  entryIndex: number,
  index: number,
) {
  const exitSide = direction === 'long' ? 'high' : 'low'
  const marker = markers.find((entry) => {
    const markerEntryIndex = Math.round(Number(entry.marker.entryIndex))
    return markerEntryIndex === index && markerEntryIndex > entryIndex && resolveRangePointSide(entry.marker.type) === exitSide
  })?.marker
  const price = Number(marker?.entryPrice ?? marker?.price)
  return Number.isFinite(price) ? price : null
}

function isStochExitCross(stochRows: StochIndicatorRow[], direction: 'long' | 'short', index: number, threshold: number) {
  const previous = Number(stochRows[index - 1]?.k)
  const current = Number(stochRows[index]?.k)
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false
  return direction === 'short'
    ? previous < threshold && current >= threshold
    : previous > threshold && current <= threshold
}

function resolveExitResult(direction: 'long' | 'short', entryPrice: number, exitPrice: number) {
  const distance = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  if (distance > 0) return { result: 'win' as const, value: distance }
  if (distance < 0) return { result: 'loss' as const, value: Math.abs(distance) }
  return null
}

function createClosedTrendRangeDistances(
  markers: MmfV2IndicatorMarker[],
  vdoRows: VdoIndicatorRow[],
  periodSeconds: number,
  startType: 'MMF_V2_RESISTANCE_DOWN_BREAK' | 'MMF_V2_SUPPORT_UP_BREAK',
) {
  const sortedMarkers = normalizeSortedMarkers(markers)
  const endTypes = new Set<MmfV2IndicatorMarker['type']>(['MMF_V2_RESISTANCE_UP_BREAK', 'MMF_V2_SUPPORT_DOWN_BREAK'])
  const distances: number[] = []
  const rangeTimes: Array<{ endTime: number; startTime: number }> = []
  let strongMomentumPoints = 0

  sortedMarkers.forEach((start, startOffset) => {
    if (start.marker.type !== startType) return
    const end = sortedMarkers
      .slice(startOffset + 1)
      .find((entry) => endTypes.has(entry.marker.type))
    const endIndex = end?.markerIndex ?? Number.POSITIVE_INFINITY
    const startTime = Number(start.marker.time)
    const endTime = Number(end?.marker.time)
    if (Number.isFinite(startTime) && Number.isFinite(endTime)) rangeTimes.push({ endTime, startTime })
    const points = sortedMarkers
      .slice(startOffset + 1)
      .filter((entry) => entry.markerIndex < endIndex)
      .map((entry) => {
        const side = resolveRangePointSide(entry.marker.type)
        const price = Number(entry.marker.price)
        return side && Number.isFinite(price) ? { markerIndex: entry.markerIndex, price, side } : null
      })
      .filter((point): point is { markerIndex: number; price: number; side: 'high' | 'low' } => point != null)

    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1]
      const current = points[index]
      if (previous.side === current.side) continue
      const distance = Math.abs(current.price - previous.price)
      if (Number.isFinite(distance)) distances.push(distance)
    }

    points.forEach((point) => {
      const marker = sortedMarkers.find((entry) => entry.markerIndex === point.markerIndex)?.marker
      if (!marker) return
      const momentum = calculatePointMomentum(marker, vdoRows, periodSeconds, point.side)
      if (momentum != null && momentum > 6) strongMomentumPoints += 1
    })
  })

  return { distances, rangeTimes, strongMomentumPoints }
}

function normalizeSortedMarkers(markers: MmfV2IndicatorMarker[]) {
  return [...markers]
    .map((marker) => ({ marker, markerIndex: Math.round(Number(marker.markerIndex ?? marker.index)) }))
    .filter((entry) => Number.isFinite(entry.markerIndex))
    .sort((left, right) => left.markerIndex - right.markerIndex)
}

function resolveRangePointSide(type: MmfV2IndicatorMarker['type']) {
  if (type === 'MMF_V2_EXPECTED_RESISTANCE' || type === 'MMF_V2_HIGH' || type === 'MMF_V2_RESISTANCE') return 'high'
  if (type === 'MMF_V2_EXPECTED_SUPPORT' || type === 'MMF_V2_LOW' || type === 'MMF_V2_SUPPORT') return 'low'
  return null
}

function calculatePointMomentum(
  marker: MmfV2IndicatorMarker,
  vdoRows: VdoIndicatorRow[],
  periodSeconds: number,
  side: 'high' | 'low',
) {
  const markerIndex = Math.round(Number(marker.markerIndex ?? marker.index))
  const entryIndex = Math.round(Number(marker.entryIndex))
  const startVdo = Number(vdoRows[markerIndex]?.vdo)
  const endVdo = Number(vdoRows[entryIndex]?.vdo)
  const bars = entryIndex - markerIndex
  const seconds = bars * periodSeconds
  if (!Number.isFinite(markerIndex) || !Number.isFinite(entryIndex) || !Number.isFinite(startVdo) || !Number.isFinite(endVdo) || bars <= 0 || seconds <= 0) return null
  const direction = side === 'low' ? 1 : -1
  const momentum = Math.abs(direction * (endVdo - startVdo)) * 1_000_000 / seconds
  return Number.isFinite(momentum) ? momentum : null
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
  const sortedMarkers = normalizeSortedMarkers(markers)

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

function summarizeRangeDistances(payload: { distances: number[]; rangeTimes: Array<{ endTime: number; startTime: number }>; strongMomentumPoints: number }): MmfV2RangeDistanceStats | null {
  const { distances, rangeTimes, strongMomentumPoints } = payload
  if (distances.length === 0) return null
  const startTimes = rangeTimes.map((range) => range.startTime)
  const endTimes = rangeTimes.map((range) => range.endTime)
  return {
    averageDistance: average(distances),
    endTime: endTimes.length > 0 ? Math.max(...endTimes) : null,
    maxDistance: Math.max(...distances),
    minDistance: Math.min(...distances),
    samples: distances.length,
    startTime: startTimes.length > 0 ? Math.min(...startTimes) : null,
    strongMomentumPoints,
  }
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
