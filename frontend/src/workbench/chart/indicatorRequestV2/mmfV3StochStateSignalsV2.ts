import type { MmfIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { finiteNumber } from './mmfV3FrontendMathV2'
import type { MmfV3FeatureRowV2 } from './mmfV3FrontendTypesV2'

export type MmfV3SignalSideV2 = 'high' | 'low'

type StochCrossEventV2 = {
  barKey: string
  d: number
  direction: 'dead' | 'golden'
  index: number
  k: number
  previousD: number
  previousIndex: number
  previousK: number
  time: number
  value: number
}

type StochConfirmEventV2 = {
  advance: number
  barKey: string
  barsUsed: number
  cross: StochCrossEventV2
  index: number
  k: number
  maxBars: number
  time: number
}

type PriceAnchorV2 = {
  barKey: string
  index: number
  price: number
  time: number
  type: MmfV3SignalSideV2
  windowEndBarKey: string
  windowEndIndex: number
  windowEndTime: number
  windowStartBarKey: string
  windowStartIndex: number
  windowStartTime: number
}

export type StochStateSignalV2 = {
  anchor: PriceAnchorV2
  confirm: StochConfirmEventV2
  cross: StochCrossEventV2
  entryBarKey: string
  entryIndex: number
  entryPrice: number
  entryTime: number
  pointDistance: number
  type: MmfV3SignalSideV2
}

function stochCrossValue(previousK: unknown, previousD: unknown, k: unknown, d: unknown) {
  if (!finiteNumber(previousK) || !finiteNumber(previousD) || !finiteNumber(k) || !finiteNumber(d)) return null
  const kDelta = k - previousK
  const dDelta = d - previousD
  const denominator = kDelta - dDelta
  if (denominator === 0) return null
  const ratio = (previousD - previousK) / denominator
  if (ratio < 0 || ratio > 1) return null
  return previousK + kDelta * ratio
}

function createCrossEvent(
  direction: 'dead' | 'golden',
  index: number,
  features: MmfV3FeatureRowV2[],
): StochCrossEventV2 | null {
  const previous = features[index - 1]
  const row = features[index]
  const value = stochCrossValue(previous?.stochK, previous?.stochD, row?.stochK, row?.stochD)
  if (value == null || !finiteNumber(previous?.stochK) || !finiteNumber(previous?.stochD) || !finiteNumber(row?.stochK) || !finiteNumber(row?.stochD)) {
    return null
  }
  if (direction === 'dead' && !(previous.stochK >= previous.stochD && row.stochK < row.stochD)) return null
  if (direction === 'golden' && !(previous.stochK <= previous.stochD && row.stochK > row.stochD)) return null
  return {
    barKey: row.barKey,
    d: row.stochD,
    direction,
    index,
    k: row.stochK,
    previousD: previous.stochD,
    previousIndex: index - 1,
    previousK: previous.stochK,
    time: row.time,
    value,
  }
}

function confirmHighCross(cross: StochCrossEventV2, index: number, features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings): StochConfirmEventV2 | null {
  const maxBars = Math.max(1, Math.trunc(settings.highConfirmLookaheadBars || 7))
  const advance = Number(settings.highStochKAdvance ?? 10)
  const k = features[index]?.stochK
  if (index <= cross.index || index - cross.index > maxBars || !finiteNumber(k)) return null
  if (k > cross.value - advance) return null
  return { advance, barKey: features[index].barKey, barsUsed: index - cross.index, cross, index, k, maxBars, time: features[index].time }
}

function confirmLowCross(cross: StochCrossEventV2, index: number, features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings): StochConfirmEventV2 | null {
  const maxBars = Math.max(1, Math.trunc(settings.lowConfirmLookaheadBars || 7))
  const advance = Number(settings.lowStochKAdvance ?? 10)
  const k = features[index]?.stochK
  if (index <= cross.index || index - cross.index > maxBars || !finiteNumber(k)) return null
  if (k < cross.value + advance) return null
  return { advance, barKey: features[index].barKey, barsUsed: index - cross.index, cross, index, k, maxBars, time: features[index].time }
}

function highestHighIndex(features: MmfV3FeatureRowV2[], startIndex: number, endIndex: number) {
  let highestIndex: number | null = null
  let highestValue: number | null = null
  for (let index = startIndex; index <= endIndex; index += 1) {
    const high = features[index]?.high
    if (!finiteNumber(high)) continue
    if (highestValue == null || high > highestValue) {
      highestValue = high
      highestIndex = index
    }
  }
  return highestIndex
}

function lowestLowIndex(features: MmfV3FeatureRowV2[], startIndex: number, endIndex: number) {
  let lowestIndex: number | null = null
  let lowestValue: number | null = null
  for (let index = startIndex; index <= endIndex; index += 1) {
    const low = features[index]?.low
    if (!finiteNumber(low)) continue
    if (lowestValue == null || low < lowestValue) {
      lowestValue = low
      lowestIndex = index
    }
  }
  return lowestIndex
}

function createAnchor(type: MmfV3SignalSideV2, index: number, price: number, startIndex: number, endIndex: number, features: MmfV3FeatureRowV2[]): PriceAnchorV2 {
  return {
    barKey: features[index].barKey,
    index,
    price,
    time: features[index].time,
    type,
    windowEndBarKey: features[endIndex].barKey,
    windowEndIndex: endIndex,
    windowEndTime: features[endIndex].time,
    windowStartBarKey: features[startIndex].barKey,
    windowStartIndex: startIndex,
    windowStartTime: features[startIndex].time,
  }
}

function createHighSignal(confirm: StochConfirmEventV2, features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings): StochStateSignalV2 | null {
  const startIndex = Math.max(0, confirm.cross.index - (Math.max(1, Math.trunc(settings.highAnchorLookbackBars || 14)) - 1))
  const endIndex = confirm.cross.index
  const markerIndex = highestHighIndex(features, startIndex, endIndex)
  if (markerIndex == null) return null
  const markerPrice = features[markerIndex].high
  const entryPrice = features[confirm.index].close
  if (!finiteNumber(markerPrice) || !finiteNumber(entryPrice)) return null
  return {
    anchor: createAnchor('high', markerIndex, markerPrice, startIndex, endIndex, features),
    confirm,
    cross: confirm.cross,
    entryBarKey: confirm.barKey,
    entryIndex: confirm.index,
    entryPrice,
    entryTime: confirm.time,
    pointDistance: Math.abs(entryPrice - markerPrice),
    type: 'high',
  }
}

function createLowSignal(confirm: StochConfirmEventV2, features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings): StochStateSignalV2 | null {
  const startIndex = Math.max(0, confirm.cross.index - (Math.max(1, Math.trunc(settings.lowAnchorLookbackBars || 14)) - 1))
  const endIndex = confirm.cross.index
  const markerIndex = lowestLowIndex(features, startIndex, endIndex)
  if (markerIndex == null) return null
  const markerPrice = features[markerIndex].low
  const entryPrice = features[confirm.index].close
  if (!finiteNumber(markerPrice) || !finiteNumber(entryPrice)) return null
  return {
    anchor: createAnchor('low', markerIndex, markerPrice, startIndex, endIndex, features),
    confirm,
    cross: confirm.cross,
    entryBarKey: confirm.barKey,
    entryIndex: confirm.index,
    entryPrice,
    entryTime: confirm.time,
    pointDistance: Math.abs(entryPrice - markerPrice),
    type: 'low',
  }
}

function mergeSameDirectionSignals(signals: StochStateSignalV2[]) {
  if (signals.length === 0) return signals
  const merged: StochStateSignalV2[] = []
  let current = signals[0]
  for (const signal of signals.slice(1)) {
    if (signal.type !== current.type) {
      merged.push(current)
      current = signal
      continue
    }
    current = current.type === 'high'
      ? signal.anchor.price > current.anchor.price ? signal : current
      : signal.anchor.price < current.anchor.price ? signal : current
  }
  merged.push(current)
  return merged
}

export function calculateStochStateSignalsV2(features: MmfV3FeatureRowV2[], settings: MmfIndicatorSettings) {
  const signals: StochStateSignalV2[] = []
  let activeHighCross: StochCrossEventV2 | null = null
  let activeLowCross: StochCrossEventV2 | null = null

  for (let index = 1; index < features.length; index += 1) {
    const deadCross = createCrossEvent('dead', index, features)
    const goldenCross = createCrossEvent('golden', index, features)

    if (settings.showHigh || settings.showResistanceLevel || settings.showTopDivergencePoint || settings.showTrendDownReboundPoint) {
      if (activeHighCross && goldenCross) activeHighCross = null
      if (activeHighCross && finiteNumber(features[index]?.stochK)) {
        const confirm = confirmHighCross(activeHighCross, index, features, settings)
        if (confirm == null && index - activeHighCross.index > Math.max(1, Math.trunc(settings.highConfirmLookaheadBars || 7))) {
          activeHighCross = null
        } else if (confirm) {
          const signal = createHighSignal(confirm, features, settings)
          if (signal) signals.push(signal)
          activeHighCross = null
        }
      }
      if (deadCross) activeHighCross = deadCross
    }

    if (settings.showLow || settings.showSupportLevel || settings.showBottomDivergencePoint || settings.showTrendUpPullbackPoint) {
      if (activeLowCross && deadCross) activeLowCross = null
      if (activeLowCross && finiteNumber(features[index]?.stochK)) {
        const confirm = confirmLowCross(activeLowCross, index, features, settings)
        if (confirm == null && index - activeLowCross.index > Math.max(1, Math.trunc(settings.lowConfirmLookaheadBars || 7))) {
          activeLowCross = null
        } else if (confirm) {
          const signal = createLowSignal(confirm, features, settings)
          if (signal) signals.push(signal)
          activeLowCross = null
        }
      }
      if (goldenCross) activeLowCross = goldenCross
    }
  }

  return mergeSameDirectionSignals(signals).sort((left, right) => left.anchor.index - right.anchor.index || left.type.localeCompare(right.type))
}
