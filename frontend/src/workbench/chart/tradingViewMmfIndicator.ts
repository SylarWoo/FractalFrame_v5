import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultDpoIndicatorSettings, defaultMmfIndicatorSettings, defaultStochIndicatorSettings, defaultVdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfIndicatorMarkers, type MmfIndicatorMarker } from '../../services/mt5/mmfIndicatorApi'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { calculateMmfHighStateMachineRows } from './mmfHighStateMachine'
import { calculateMorganRangeSegments, getMorganRangeLevel } from './morganRangeModel'
import type { MorganRangeSegment } from './morganRangeModel'
import { calculateTradingViewDpoRows } from './tradingViewDpoIndicator'
import { calculateTradingViewStochRows } from './tradingViewStochIndicator'
import { calculateTradingViewVdoRows } from './tradingViewVdoIndicator'

export type MmfIndicatorRow = {
  highMarker?: number
  highMarkerPrice?: number
  highRangeEndIndex?: number
  highRangeStartIndex?: number
  lowMarker?: number
  lowMarkerPrice?: number
  lowRangeEndIndex?: number
  lowRangeStartIndex?: number
  pullbackMarker?: number
  pullbackMarkerPrice?: number
  reboundMarker?: number
  reboundMarkerPrice?: number
  resistanceMarker?: number
  resistanceMarkerPrice?: number
  supportMarker?: number
  supportMarkerPrice?: number
  trendDownMarker?: number
  trendDownMarkerPrice?: number
  trendUpMarker?: number
  trendUpMarkerPrice?: number
  downBreakMarker?: number
  downBreakMarkerPrice?: number
  upBreakMarker?: number
  upBreakMarkerPrice?: number
}

type MmfCalcContext = {
  period?: string
  stochDSmoothing?: number
  stochKSmoothing?: number
  stochLength?: number
  symbol?: string
}

type NormalizedMmfCalcContext = Required<Pick<MmfCalcContext, 'period' | 'symbol' | 'stochDSmoothing' | 'stochKSmoothing' | 'stochLength'>>

type MmfMarkerSpec = {
  color: (settings: MmfIndicatorSettings) => string
  markerKey: keyof Pick<MmfIndicatorRow, 'downBreakMarker' | 'highMarker' | 'lowMarker' | 'pullbackMarker' | 'reboundMarker' | 'resistanceMarker' | 'supportMarker' | 'trendDownMarker' | 'trendUpMarker' | 'upBreakMarker'>
  markerType?: MmfIndicatorMarker['type']
  offsetMultiplier: number
  priceKey: keyof Pick<MmfIndicatorRow, 'downBreakMarkerPrice' | 'highMarkerPrice' | 'lowMarkerPrice' | 'pullbackMarkerPrice' | 'reboundMarkerPrice' | 'resistanceMarkerPrice' | 'supportMarkerPrice' | 'trendDownMarkerPrice' | 'trendUpMarkerPrice' | 'upBreakMarkerPrice'>
  show: (settings: MmfIndicatorSettings) => boolean
  size: (settings: MmfIndicatorSettings) => number
  symbol: (settings: MmfIndicatorSettings) => string
  textBaseline: CanvasTextBaseline
  title: string
  yDirection: -1 | 1
}

let registered = false
const remoteMmfEngineVersion = 'mmf-engine-v46-dedupe-extreme-windows'
const remoteMmfRowsCacheMax = 24
const remoteMmfRowsBySignature = new Map<string, Promise<MmfIndicatorRow[]> | MmfIndicatorRow[]>()
const mmfInternalStochSettings = {
  ...defaultStochIndicatorSettings,
  dSmoothing: 4,
  kSmoothing: 6,
  length: 28,
}
const mmfInternalVdoSettings = {
  ...defaultVdoIndicatorSettings,
  emaSmoothing: 12,
  length: 120,
}

function normalizeMmfSettings(input?: Partial<MmfIndicatorSettings>): MmfIndicatorSettings {
  return { ...defaultMmfIndicatorSettings, ...(input ?? {}) }
}

function normalizeStoreTimeframe(period?: string) {
  const value = String(period || 'M5').trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value.endsWith('M') && value !== 'MN1') return `M${value.slice(0, -1)}`
  if (value.endsWith('H')) return `H${value.slice(0, -1)}`
  return value
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.max(1, Math.min(number, 500)) : fallback
}

function normalizeMmfContext(input: unknown): NormalizedMmfCalcContext {
  const context = input && typeof input === 'object' ? input as MmfCalcContext : {}
  return {
    period: normalizeStoreTimeframe(context.period),
    stochDSmoothing: normalizePositiveInteger(context.stochDSmoothing, defaultStochIndicatorSettings.dSmoothing),
    stochKSmoothing: normalizePositiveInteger(context.stochKSmoothing, defaultStochIndicatorSettings.kSmoothing),
    stochLength: normalizePositiveInteger(context.stochLength, defaultStochIndicatorSettings.length),
    symbol: typeof context.symbol === 'string' && context.symbol.trim() ? context.symbol.trim() : '',
  }
}

function clampMarkerSize(value: unknown, fallback = defaultMmfIndicatorSettings.highSize) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : fallback
}

const mmfMarkerSpecs: MmfMarkerSpec[] = [
  {
    color: (settings) => settings.highColor || defaultMmfIndicatorSettings.highColor,
    markerKey: 'highMarker',
    markerType: 'MMF_HIGH',
    offsetMultiplier: 0.25,
    priceKey: 'highMarkerPrice',
    show: (settings) => settings.showHigh,
    size: (settings) => clampMarkerSize(settings.highSize, defaultMmfIndicatorSettings.highSize),
    symbol: (settings) => settings.highSymbol || defaultMmfIndicatorSettings.highSymbol,
    textBaseline: 'bottom',
    title: 'High ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.upBreakColor || defaultMmfIndicatorSettings.upBreakColor,
    markerKey: 'upBreakMarker',
    offsetMultiplier: 1.15,
    priceKey: 'upBreakMarkerPrice',
    show: (settings) => settings.showUpBreakPoint,
    size: (settings) => clampMarkerSize(settings.upBreakSize, defaultMmfIndicatorSettings.upBreakSize),
    symbol: (settings) => settings.upBreakSymbol || defaultMmfIndicatorSettings.upBreakSymbol,
    textBaseline: 'bottom',
    title: 'Up Direction ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.lowColor || defaultMmfIndicatorSettings.lowColor,
    markerKey: 'lowMarker',
    markerType: 'MMF_LOW',
    offsetMultiplier: 0.25,
    priceKey: 'lowMarkerPrice',
    show: (settings) => settings.showLow,
    size: (settings) => clampMarkerSize(settings.lowSize, defaultMmfIndicatorSettings.lowSize),
    symbol: (settings) => settings.lowSymbol || defaultMmfIndicatorSettings.lowSymbol,
    textBaseline: 'top',
    title: 'Low ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.downBreakColor || defaultMmfIndicatorSettings.downBreakColor,
    markerKey: 'downBreakMarker',
    offsetMultiplier: 1.15,
    priceKey: 'downBreakMarkerPrice',
    show: (settings) => settings.showDownBreakPoint,
    size: (settings) => clampMarkerSize(settings.downBreakSize, defaultMmfIndicatorSettings.downBreakSize),
    symbol: (settings) => settings.downBreakSymbol || defaultMmfIndicatorSettings.downBreakSymbol,
    textBaseline: 'top',
    title: 'Down Direction ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.resistanceColor || defaultMmfIndicatorSettings.resistanceColor,
    markerKey: 'resistanceMarker',
    offsetMultiplier: 1.15,
    priceKey: 'resistanceMarkerPrice',
    show: (settings) => settings.showResistanceLevel,
    size: (settings) => clampMarkerSize(settings.resistanceSize, defaultMmfIndicatorSettings.resistanceSize),
    symbol: (settings) => settings.resistanceSymbol || defaultMmfIndicatorSettings.resistanceSymbol,
    textBaseline: 'bottom',
    title: 'Resistance ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.supportColor || defaultMmfIndicatorSettings.supportColor,
    markerKey: 'supportMarker',
    offsetMultiplier: 1.15,
    priceKey: 'supportMarkerPrice',
    show: (settings) => settings.showSupportLevel,
    size: (settings) => clampMarkerSize(settings.supportSize, defaultMmfIndicatorSettings.supportSize),
    symbol: (settings) => settings.supportSymbol || defaultMmfIndicatorSettings.supportSymbol,
    textBaseline: 'top',
    title: 'Support ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.trendDownColor || defaultMmfIndicatorSettings.trendDownColor,
    markerKey: 'trendDownMarker',
    offsetMultiplier: 1.15,
    priceKey: 'trendDownMarkerPrice',
    show: (settings) => settings.showTrendDownPoint,
    size: (settings) => clampMarkerSize(settings.trendDownSize, defaultMmfIndicatorSettings.trendDownSize),
    symbol: (settings) => settings.trendDownSymbol || defaultMmfIndicatorSettings.trendDownSymbol,
    textBaseline: 'top',
    title: 'Trend Down ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.trendUpColor || defaultMmfIndicatorSettings.trendUpColor,
    markerKey: 'trendUpMarker',
    offsetMultiplier: 1.15,
    priceKey: 'trendUpMarkerPrice',
    show: (settings) => settings.showTrendUpPoint,
    size: (settings) => clampMarkerSize(settings.trendUpSize, defaultMmfIndicatorSettings.trendUpSize),
    symbol: (settings) => settings.trendUpSymbol || defaultMmfIndicatorSettings.trendUpSymbol,
    textBaseline: 'bottom',
    title: 'Trend Up ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.reboundColor || defaultMmfIndicatorSettings.reboundColor,
    markerKey: 'reboundMarker',
    offsetMultiplier: 0.25,
    priceKey: 'reboundMarkerPrice',
    show: (settings) => settings.showReboundPoint,
    size: (settings) => clampMarkerSize(settings.reboundSize, defaultMmfIndicatorSettings.reboundSize),
    symbol: (settings) => settings.reboundSymbol || defaultMmfIndicatorSettings.reboundSymbol,
    textBaseline: 'bottom',
    title: 'Rebound ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.pullbackColor || defaultMmfIndicatorSettings.pullbackColor,
    markerKey: 'pullbackMarker',
    offsetMultiplier: 0.25,
    priceKey: 'pullbackMarkerPrice',
    show: (settings) => settings.showPullbackPoint,
    size: (settings) => clampMarkerSize(settings.pullbackSize, defaultMmfIndicatorSettings.pullbackSize),
    symbol: (settings) => settings.pullbackSymbol || defaultMmfIndicatorSettings.pullbackSymbol,
    textBaseline: 'top',
    title: 'Pullback ',
    yDirection: 1,
  },
]

function resolveAdjustedMorganRatioValue(ratio: unknown, offsetPercent: unknown) {
  const selected = Number(ratio)
  if (!Number.isFinite(selected)) return 0.118
  const sign = selected < 0 ? -1 : 1
  const selectedMagnitude = Math.abs(selected)
  const offset = Math.max(-99, Math.min(Math.round(Number(offsetPercent)), 99))
  if (offset === 0) return sign * selectedMagnitude

  const upperRatios = [0.059, 0.118, 0.177, 0.236, 0.309]
  const index = upperRatios.findIndex((ratio) => Math.abs(ratio - selectedMagnitude) < 0.0005)
  if (index < 0) return sign * selectedMagnitude
  const target = offset > 0
    ? upperRatios[Math.min(upperRatios.length - 1, index + 1)]
    : upperRatios[Math.max(0, index - 1)]

  return sign * (selectedMagnitude + (target - selectedMagnitude) * (Math.abs(offset) / 100))
}

function resolveAdjustedHighMorganRatio(settings: MmfIndicatorSettings) {
  return resolveAdjustedMorganRatioValue(settings.highMorganRatio, settings.highOffsetPercent)
}

function resolveAdjustedLowMorganRatio(settings: MmfIndicatorSettings) {
  return resolveAdjustedMorganRatioValue(settings.lowMorganRatio, settings.lowOffsetPercent)
}

function createMorganSegmentByIndex(dataLength: number, segments: MorganRangeSegment[]) {
  const output: Array<MorganRangeSegment | null> = Array.from({ length: dataLength }, () => null)
  segments.forEach((segment) => {
    const start = Math.max(0, segment.startIndex)
    const end = Math.min(dataLength - 1, segment.endIndex)
    for (let index = start; index <= end; index += 1) {
      output[index] = segment
    }
  })
  return output
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MmfIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function calculateTradingViewMmfRowsInternal(dataList: KLineData[], inputSettings?: Partial<MmfIndicatorSettings>): MmfIndicatorRow[] {
  const settings = normalizeMmfSettings(inputSettings)
  if (!settings.showHigh) return dataList.map(() => ({}))

  const stochRows = calculateTradingViewStochRows(dataList, defaultStochIndicatorSettings)
  const dpoRows = calculateTradingViewDpoRows(dataList, defaultDpoIndicatorSettings)
  const morganSegments = calculateMorganRangeSegments(dataList)
  const morganSegmentByIndex = createMorganSegmentByIndex(dataList.length, morganSegments)
  const morganRatio = resolveAdjustedHighMorganRatio(settings)
  const dpoThreshold = Number(settings.dpoValue)
  const stateMachineRows = dataList.map((candle, index) => {
    const high = Number(candle?.high)
    const segment = morganSegmentByIndex[index]
    const segmentIndex = Number.isFinite(segment?.index) ? segment!.index : null
    const morganLevel = getMorganRangeLevel(segment, morganRatio)?.price
    const dpo = dpoRows[index]?.dpo
    const stoch = stochRows[index]

    return {
      d: stoch?.d,
      dpo,
      high: Number.isFinite(high) ? high : undefined,
      k: stoch?.k,
      morganLevel,
      morganSegmentIndex: segmentIndex,
    }
  })

  return calculateMmfHighStateMachineRows(stateMachineRows, {
    dpoThreshold,
  })
}

export function calculateTradingViewMmfRows(dataList: KLineData[], inputSettings?: Partial<MmfIndicatorSettings>): MmfIndicatorRow[] {
  return calculateTradingViewMmfRowsInternal(dataList, inputSettings)
}

function createEmptyMmfRows(length: number): MmfIndicatorRow[] {
  return Array.from({ length }, () => ({}))
}

function resolveVdoRange(lower: unknown, upper: unknown) {
  const lowerValue = Number(lower)
  const upperValue = Number(upper)
  const safeLower = Number.isFinite(lowerValue) ? lowerValue : -0.05
  const safeUpper = Number.isFinite(upperValue) ? upperValue : 0.05
  return {
    lower: Math.min(safeLower, safeUpper),
    upper: Math.max(safeLower, safeUpper),
  }
}

function isValueInRange(value: unknown, lower: number, upper: number) {
  const number = Number(value)
  return Number.isFinite(number) && number >= lower && number <= upper
}

function areVdoRowsInCenteredWindow(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  lower: number,
  upper: number,
) {
  const maxIndex = vdoRows.length - 1
  if (!Number.isFinite(centerIndex) || maxIndex < 0) return false
  const center = Math.max(0, Math.min(Math.round(centerIndex), maxIndex))
  const from = Math.max(0, center - radius)
  const to = Math.min(maxIndex, center + radius)

  for (let index = from; index <= to; index += 1) {
    if (!isValueInRange(vdoRows[index]?.vdo, lower, upper)) return false
  }
  return true
}

function isResistanceVdoWindowMatched(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  lower: number,
  upper: number,
) {
  const maxIndex = vdoRows.length - 1
  if (!Number.isFinite(centerIndex) || maxIndex < 0) return false
  const center = Math.max(0, Math.min(Math.round(centerIndex), maxIndex))
  const from = Math.max(0, center - radius)
  const to = Math.min(maxIndex, center + radius)
  let hasBreak = false

  for (let index = from; index <= to; index += 1) {
    const value = Number(vdoRows[index]?.vdo)
    if (!Number.isFinite(value)) return false
    if (value > upper) return false
    if (value >= lower) hasBreak = true
  }
  return hasBreak
}

function isSupportVdoWindowMatched(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  lower: number,
  upper: number,
) {
  const maxIndex = vdoRows.length - 1
  if (!Number.isFinite(centerIndex) || maxIndex < 0) return false
  const center = Math.max(0, Math.min(Math.round(centerIndex), maxIndex))
  const from = Math.max(0, center - radius)
  const to = Math.min(maxIndex, center + radius)
  let hasBreak = false

  for (let index = from; index <= to; index += 1) {
    const value = Number(vdoRows[index]?.vdo)
    if (!Number.isFinite(value)) return false
    if (value < lower) return false
    if (value <= upper) hasBreak = true
  }
  return hasBreak
}

function areVdoRowsAtOrBelowThreshold(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  threshold: number,
) {
  const maxIndex = vdoRows.length - 1
  if (!Number.isFinite(centerIndex) || maxIndex < 0 || !Number.isFinite(threshold)) return false
  const center = Math.max(0, Math.min(Math.round(centerIndex), maxIndex))
  const from = Math.max(0, center - radius)
  const to = Math.min(maxIndex, center + radius)

  for (let index = from; index <= to; index += 1) {
    const value = Number(vdoRows[index]?.vdo)
    if (!Number.isFinite(value) || value > threshold) return false
  }
  return true
}

function areVdoRowsAtOrAboveThreshold(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  threshold: number,
) {
  const maxIndex = vdoRows.length - 1
  if (!Number.isFinite(centerIndex) || maxIndex < 0 || !Number.isFinite(threshold)) return false
  const center = Math.max(0, Math.min(Math.round(centerIndex), maxIndex))
  const from = Math.max(0, center - radius)
  const to = Math.min(maxIndex, center + radius)

  for (let index = from; index <= to; index += 1) {
    const value = Number(vdoRows[index]?.vdo)
    if (!Number.isFinite(value) || value < threshold) return false
  }
  return true
}

function resolveStochCrossValue(previousK: unknown, previousD: unknown, k: unknown, d: unknown) {
  const previousKNumber = Number(previousK)
  const previousDNumber = Number(previousD)
  const kNumber = Number(k)
  const dNumber = Number(d)
  if (!Number.isFinite(previousKNumber) || !Number.isFinite(previousDNumber) || !Number.isFinite(kNumber) || !Number.isFinite(dNumber)) return null
  const denominator = (kNumber - previousKNumber) - (dNumber - previousDNumber)
  if (denominator === 0) return null
  const ratio = (previousDNumber - previousKNumber) / denominator
  if (ratio < 0 || ratio > 1) return null
  return previousKNumber + (kNumber - previousKNumber) * ratio
}

function resolveStochDeadCrossValue(previousK: unknown, previousD: unknown, k: unknown, d: unknown) {
  const previousKNumber = Number(previousK)
  const previousDNumber = Number(previousD)
  const kNumber = Number(k)
  const dNumber = Number(d)
  if (!Number.isFinite(previousKNumber) || !Number.isFinite(previousDNumber) || !Number.isFinite(kNumber) || !Number.isFinite(dNumber)) return null
  if (!(previousKNumber >= previousDNumber && kNumber < dNumber)) return null
  const crossValue = resolveStochCrossValue(previousKNumber, previousDNumber, kNumber, dNumber)
  return crossValue
}

function resolveStochGoldenCrossValue(previousK: unknown, previousD: unknown, k: unknown, d: unknown) {
  const previousKNumber = Number(previousK)
  const previousDNumber = Number(previousD)
  const kNumber = Number(k)
  const dNumber = Number(d)
  if (!Number.isFinite(previousKNumber) || !Number.isFinite(previousDNumber) || !Number.isFinite(kNumber) || !Number.isFinite(dNumber)) return null
  if (!(previousKNumber <= previousDNumber && kNumber > dNumber)) return null
  const crossValue = resolveStochCrossValue(previousKNumber, previousDNumber, kNumber, dNumber)
  return crossValue
}

function hasHighMarkerNearIndex(outputRows: MmfIndicatorRow[], markerIndex: number, price: number) {
  const from = Math.max(0, markerIndex - 1)
  const to = Math.min(outputRows.length - 1, markerIndex + 1)
  for (let index = from; index <= to; index += 1) {
    const highMarker = Number(outputRows[index]?.highMarker)
    if (!Number.isFinite(highMarker)) continue
    if (index === markerIndex) return true
    if (Number.isFinite(price) && Math.abs(highMarker - price) < 0.000001) return true
  }
  return false
}

function hasHighMarkerInCenteredWindow(outputRows: MmfIndicatorRow[], centerIndex: number, radius: number) {
  const from = Math.max(0, centerIndex - radius)
  const to = Math.min(outputRows.length - 1, centerIndex + radius)
  for (let index = from; index <= to; index += 1) {
    if (Number.isFinite(outputRows[index]?.highMarker)) return true
  }
  return false
}

function findHighestHighInCenteredWindow(realRows: KLineData[], centerIndex: number, radius: number) {
  const from = Math.max(0, centerIndex - radius)
  const to = Math.min(realRows.length - 1, centerIndex + radius)
  let highestHigh = Number.NEGATIVE_INFINITY
  let highestHighIndex = -1
  for (let index = from; index <= to; index += 1) {
    const high = Number(realRows[index]?.high)
    if (Number.isFinite(high) && high > highestHigh) {
      highestHigh = high
      highestHighIndex = index
    }
  }
  return highestHighIndex >= 0 ? { index: highestHighIndex, price: highestHigh } : null
}

function hasVdoAboveThresholdInCenteredWindow(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  threshold: number,
) {
  if (!Number.isFinite(threshold)) return true
  const from = Math.max(0, centerIndex - radius)
  const to = Math.min(vdoRows.length - 1, centerIndex + radius)
  for (let index = from; index <= to; index += 1) {
    const value = Number(vdoRows[index]?.vdo)
    if (!Number.isFinite(value)) return true
    if (value > threshold) return true
  }
  return false
}

function hasLowMarkerNearIndex(outputRows: MmfIndicatorRow[], markerIndex: number, price: number) {
  const from = Math.max(0, markerIndex - 1)
  const to = Math.min(outputRows.length - 1, markerIndex + 1)
  for (let index = from; index <= to; index += 1) {
    const lowMarker = Number(outputRows[index]?.lowMarker)
    if (!Number.isFinite(lowMarker)) continue
    if (index === markerIndex) return true
    if (Number.isFinite(price) && Math.abs(lowMarker - price) < 0.000001) return true
  }
  return false
}

function hasLowMarkerInCenteredWindow(outputRows: MmfIndicatorRow[], centerIndex: number, radius: number) {
  const from = Math.max(0, centerIndex - radius)
  const to = Math.min(outputRows.length - 1, centerIndex + radius)
  for (let index = from; index <= to; index += 1) {
    if (Number.isFinite(outputRows[index]?.lowMarker)) return true
  }
  return false
}

function findLowestLowInCenteredWindow(realRows: KLineData[], centerIndex: number, radius: number) {
  const from = Math.max(0, centerIndex - radius)
  const to = Math.min(realRows.length - 1, centerIndex + radius)
  let lowestLow = Number.POSITIVE_INFINITY
  let lowestLowIndex = -1
  for (let index = from; index <= to; index += 1) {
    const low = Number(realRows[index]?.low)
    if (Number.isFinite(low) && low < lowestLow) {
      lowestLow = low
      lowestLowIndex = index
    }
  }
  return lowestLowIndex >= 0 ? { index: lowestLowIndex, price: lowestLow } : null
}

function hasVdoBelowThresholdInCenteredWindow(
  vdoRows: ReturnType<typeof calculateTradingViewVdoRows>,
  centerIndex: number,
  radius: number,
  threshold: number,
) {
  if (!Number.isFinite(threshold)) return true
  const from = Math.max(0, centerIndex - radius)
  const to = Math.min(vdoRows.length - 1, centerIndex + radius)
  for (let index = from; index <= to; index += 1) {
    const value = Number(vdoRows[index]?.vdo)
    if (!Number.isFinite(value)) return true
    if (value < threshold) return true
  }
  return false
}

function applyReboundMarkers(realRows: KLineData[], stochRows: ReturnType<typeof calculateTradingViewStochRows>, vdoRows: ReturnType<typeof calculateTradingViewVdoRows>, outputRows: MmfIndicatorRow[], settings: MmfIndicatorSettings) {
  if (!settings.showReboundPoint) return
  const confirmDistance = 7
  const crossLevel = 50
  const markerWindowRadius = 7
  const vdoThreshold = Number(settings.reboundVdoThreshold)

  let armed = false
  let active: {
    crossValue: number
    crossIndex: number
  } | null = null

  for (let index = 1; index < realRows.length; index += 1) {
    if (Number.isFinite(outputRows[index]?.trendDownMarker)) {
      armed = true
      active = null
      continue
    }
    if (!armed) continue

    const row = stochRows[index]
    const previousRow = stochRows[index - 1]
    const k = Number(row?.k)

    const deadCrossValue = resolveStochDeadCrossValue(previousRow?.k, previousRow?.d, row?.k, row?.d)
    if (!active && deadCrossValue != null && deadCrossValue > crossLevel) {
      active = {
        crossValue: deadCrossValue,
        crossIndex: index,
      }
    }
    if (!active) continue

    if (Number.isFinite(k) && active.crossValue - k >= confirmDistance) {
      if (!hasHighMarkerInCenteredWindow(outputRows, active.crossIndex, markerWindowRadius)) {
        const marker = findHighestHighInCenteredWindow(realRows, active.crossIndex, markerWindowRadius)
        if (
          marker
          && !hasVdoAboveThresholdInCenteredWindow(vdoRows, active.crossIndex, markerWindowRadius, vdoThreshold)
          && !hasHighMarkerInCenteredWindow(outputRows, marker.index, markerWindowRadius)
          && !hasHighMarkerNearIndex(outputRows, marker.index, marker.price)
        ) {
          outputRows[marker.index] = {
            ...outputRows[marker.index],
            reboundMarker: marker.price,
            reboundMarkerPrice: marker.price,
          }
        }
      }
      active = null
      armed = false
    }
  }
}

function applyPullbackMarkers(realRows: KLineData[], stochRows: ReturnType<typeof calculateTradingViewStochRows>, vdoRows: ReturnType<typeof calculateTradingViewVdoRows>, outputRows: MmfIndicatorRow[], settings: MmfIndicatorSettings) {
  if (!settings.showPullbackPoint) return
  const confirmDistance = 7
  const crossLevel = 50
  const markerWindowRadius = 7
  const vdoThreshold = Number(settings.pullbackVdoThreshold)

  let armed = false
  let active: {
    crossValue: number
    crossIndex: number
  } | null = null

  for (let index = 1; index < realRows.length; index += 1) {
    if (Number.isFinite(outputRows[index]?.trendUpMarker)) {
      armed = true
      active = null
      continue
    }
    if (!armed) continue

    const row = stochRows[index]
    const previousRow = stochRows[index - 1]
    const k = Number(row?.k)

    const goldenCrossValue = resolveStochGoldenCrossValue(previousRow?.k, previousRow?.d, row?.k, row?.d)
    if (!active && goldenCrossValue != null && goldenCrossValue < crossLevel) {
      active = {
        crossValue: goldenCrossValue,
        crossIndex: index,
      }
    }
    if (!active) continue

    if (Number.isFinite(k) && k - active.crossValue >= confirmDistance) {
      if (!hasLowMarkerInCenteredWindow(outputRows, active.crossIndex, markerWindowRadius)) {
        const marker = findLowestLowInCenteredWindow(realRows, active.crossIndex, markerWindowRadius)
        if (
          marker
          && !hasVdoBelowThresholdInCenteredWindow(vdoRows, active.crossIndex, markerWindowRadius, vdoThreshold)
          && !hasLowMarkerInCenteredWindow(outputRows, marker.index, markerWindowRadius)
          && !hasLowMarkerNearIndex(outputRows, marker.index, marker.price)
        ) {
          outputRows[marker.index] = {
            ...outputRows[marker.index],
            pullbackMarker: marker.price,
            pullbackMarkerPrice: marker.price,
          }
        }
      }
      active = null
      armed = false
    }
  }
}

function applyVdoDerivedMarkers(realRows: KLineData[], outputRows: MmfIndicatorRow[], settings: MmfIndicatorSettings) {
  if (
    !settings.showUpBreakPoint
    && !settings.showDownBreakPoint
    && !settings.showResistanceLevel
    && !settings.showSupportLevel
    && !settings.showTrendDownPoint
    && !settings.showTrendUpPoint
    && !settings.showReboundPoint
    && !settings.showPullbackPoint
  ) return
  const vdoRows = calculateTradingViewVdoRows(realRows, mmfInternalVdoSettings)
  const stochRows = settings.showReboundPoint || settings.showPullbackPoint ? calculateTradingViewStochRows(realRows, mmfInternalStochSettings) : []
  const upRange = resolveVdoRange(settings.upBreakVdoLower, settings.upBreakVdoUpper)
  const downRange = resolveVdoRange(settings.downBreakVdoLower, settings.downBreakVdoUpper)
  const resistanceRange = resolveVdoRange(settings.resistanceVdoLower, settings.resistanceVdoUpper)
  const supportRange = resolveVdoRange(settings.supportVdoLower, settings.supportVdoUpper)

  outputRows.forEach((row, index) => {
    if (
      settings.showUpBreakPoint
      && Number.isFinite(row.highMarker)
      && areVdoRowsInCenteredWindow(vdoRows, index, 5, upRange.lower, upRange.upper)
    ) {
      row.upBreakMarker = row.highMarker
      row.upBreakMarkerPrice = row.highMarkerPrice ?? row.highMarker
    }
    if (
      settings.showDownBreakPoint
      && Number.isFinite(row.lowMarker)
      && areVdoRowsInCenteredWindow(vdoRows, index, 5, downRange.lower, downRange.upper)
    ) {
      row.downBreakMarker = row.lowMarker
      row.downBreakMarkerPrice = row.lowMarkerPrice ?? row.lowMarker
    }
    if (
      settings.showResistanceLevel
      && Number.isFinite(row.highMarker)
      && isResistanceVdoWindowMatched(vdoRows, index, 5, resistanceRange.lower, resistanceRange.upper)
    ) {
      row.resistanceMarker = row.highMarker
      row.resistanceMarkerPrice = row.highMarkerPrice ?? row.highMarker
    }
    if (
      settings.showSupportLevel
      && Number.isFinite(row.lowMarker)
      && isSupportVdoWindowMatched(vdoRows, index, 5, supportRange.lower, supportRange.upper)
    ) {
      row.supportMarker = row.lowMarker
      row.supportMarkerPrice = row.lowMarkerPrice ?? row.lowMarker
    }
    if (
      settings.showTrendDownPoint
      && Number.isFinite(row.lowMarker)
      && areVdoRowsAtOrBelowThreshold(vdoRows, index, 5, Number(settings.trendDownVdoUpper))
    ) {
      row.trendDownMarker = row.lowMarker
      row.trendDownMarkerPrice = row.lowMarkerPrice ?? row.lowMarker
    }
    if (
      settings.showTrendUpPoint
      && Number.isFinite(row.highMarker)
      && areVdoRowsAtOrAboveThreshold(vdoRows, index, 5, Number(settings.trendUpVdoUpper))
    ) {
      row.trendUpMarker = row.highMarker
      row.trendUpMarkerPrice = row.highMarkerPrice ?? row.highMarker
    }
  })
  applyReboundMarkers(realRows, stochRows, vdoRows, outputRows, settings)
  applyPullbackMarkers(realRows, stochRows, vdoRows, outputRows, settings)
}

function createMmfRowsFromMarkers(realRows: KLineData[], markers: MmfIndicatorMarker[], settings: MmfIndicatorSettings): MmfIndicatorRow[] {
  const markersByTypeAndTime = new Map<MmfIndicatorMarker['type'], Map<number, MmfIndicatorMarker>>()
  mmfMarkerSpecs.forEach((spec) => {
    if (!spec.markerType) return
    markersByTypeAndTime.set(spec.markerType, new Map())
  })

  markers.forEach((marker) => {
    const time = Number(marker.time)
    const price = Number(marker.price)
    if (!Number.isFinite(time) || !Number.isFinite(price)) return
    markersByTypeAndTime.get(marker.type)?.set(time, marker)
  })

  const outputRows = realRows.map((row) => {
    const timestamp = Number(row.timestamp)
    const time = Math.floor(timestamp / 1000)
    const output: MmfIndicatorRow = {}
    mmfMarkerSpecs.forEach((spec) => {
      if (!spec.markerType) return
      const marker = markersByTypeAndTime.get(spec.markerType)?.get(time)
      const price = Number(marker?.price)
      if (!Number.isFinite(price)) return
      output[spec.markerKey] = price
      output[spec.priceKey] = price
      if (marker?.type === 'MMF_HIGH') {
        output.highRangeStartIndex = marker.startIndex
        output.highRangeEndIndex = marker.endIndex
      } else if (marker?.type === 'MMF_LOW') {
        output.lowRangeStartIndex = marker.startIndex
        output.lowRangeEndIndex = marker.endIndex
      }
    })
    return output
  })
  applyVdoDerivedMarkers(realRows, outputRows, settings)
  return outputRows
}

function mergeRealRowsWithPlaceholders(dataList: KLineData[], realRows: MmfIndicatorRow[]) {
  const result: MmfIndicatorRow[] = []
  let realIndex = 0
  dataList.forEach((row) => {
    if (isFuturePlaceholder(row)) {
      result.push({})
      return
    }
    result.push(realRows[realIndex] ?? {})
    realIndex += 1
  })
  return result
}

function createRemoteMmfSignature(realRows: KLineData[], settings: MmfIndicatorSettings, context: NormalizedMmfCalcContext) {
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    remoteMmfEngineVersion,
    context.symbol.toUpperCase(),
    context.period,
    realRows.length,
    Math.floor(Number(first?.timestamp ?? 0) / 1000),
    Math.floor(Number(last?.timestamp ?? 0) / 1000),
    settings.showHigh ? 'H1' : 'H0',
    settings.showLow ? 'L1' : 'L0',
    settings.showUpBreakPoint ? 'UB1' : 'UB0',
    settings.showDownBreakPoint ? 'DB1' : 'DB0',
    settings.showResistanceLevel ? 'R1' : 'R0',
    settings.showSupportLevel ? 'S1' : 'S0',
    settings.showTrendDownPoint ? 'TD1' : 'TD0',
    settings.showTrendUpPoint ? 'TU1' : 'TU0',
    settings.showReboundPoint ? 'RB1' : 'RB0',
    settings.showPullbackPoint ? 'PB1' : 'PB0',
    settings.dpoValue,
    settings.highMorganRatio,
    settings.highOffsetPercent,
    settings.lowDpoValue,
    settings.lowMorganRatio,
    settings.lowOffsetPercent,
    settings.upBreakVdoLower,
    settings.upBreakVdoUpper,
    settings.downBreakVdoLower,
    settings.downBreakVdoUpper,
    settings.resistanceVdoLower,
    settings.resistanceVdoUpper,
    settings.supportVdoLower,
    settings.supportVdoUpper,
    settings.trendDownVdoUpper,
    settings.trendUpVdoUpper,
    settings.reboundVdoThreshold,
    settings.pullbackVdoThreshold,
    settings.upBreakSymbol,
    settings.upBreakSize,
    settings.upBreakColor,
    settings.downBreakSymbol,
    settings.downBreakSize,
    settings.downBreakColor,
    settings.resistanceSymbol,
    settings.resistanceSize,
    settings.resistanceColor,
    settings.supportSymbol,
    settings.supportSize,
    settings.supportColor,
    settings.trendDownSymbol,
    settings.trendDownSize,
    settings.trendDownColor,
    settings.trendUpSymbol,
    settings.trendUpSize,
    settings.trendUpColor,
    settings.reboundSymbol,
    settings.reboundSize,
    settings.reboundColor,
    settings.pullbackSymbol,
    settings.pullbackSize,
    settings.pullbackColor,
    context.stochLength,
    context.stochKSmoothing,
    context.stochDSmoothing,
  ].join('|')
}

function getCachedRemoteMmfRows(signature: string) {
  const cached = remoteMmfRowsBySignature.get(signature)
  if (cached) {
    remoteMmfRowsBySignature.delete(signature)
    remoteMmfRowsBySignature.set(signature, cached)
  }
  return cached
}

function setCachedRemoteMmfRows(signature: string, rows: Promise<MmfIndicatorRow[]> | MmfIndicatorRow[]) {
  remoteMmfRowsBySignature.set(signature, rows)
  while (remoteMmfRowsBySignature.size > remoteMmfRowsCacheMax) {
    const oldest = remoteMmfRowsBySignature.keys().next().value
    if (oldest == null) break
    remoteMmfRowsBySignature.delete(oldest)
  }
}

async function calculateRemoteMmfRows(
  dataList: KLineData[],
  inputSettings?: Partial<MmfIndicatorSettings>,
  inputContext?: unknown,
): Promise<MmfIndicatorRow[]> {
  const settings = normalizeMmfSettings(inputSettings)
  if (!settings.showHigh && !settings.showLow) return createEmptyMmfRows(dataList.length)
  const context = normalizeMmfContext(inputContext)
  const realRows = stripFuturePlaceholders(dataList)
  if (!context.symbol || realRows.length === 0) return mergeRealRowsWithPlaceholders(dataList, createEmptyMmfRows(realRows.length))

  const signature = createRemoteMmfSignature(realRows, settings, context)
  const cached = getCachedRemoteMmfRows(signature)
  if (cached) return mergeRealRowsWithPlaceholders(dataList, await cached)

  const rows = realRows.map((row) => ({
    close: Number(row.close),
    high: Number(row.high),
    low: Number(row.low),
    open: Number(row.open),
    time: Math.floor(Number(row.timestamp) / 1000),
    volume: Number(row.volume ?? 0),
  })).filter((row) => (
    Number.isFinite(row.time) &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close)
  ))
  const effectiveHighMorganRatio = resolveAdjustedHighMorganRatio(settings)
  const effectiveLowMorganRatio = resolveAdjustedLowMorganRatio(settings)

  const request = calculateMmfIndicatorMarkers({
    rows,
    settings: {
      dpoValue: settings.dpoValue,
      highMorganRatio: String(effectiveHighMorganRatio),
      highOffsetPercent: 0,
      lowDpoValue: settings.lowDpoValue,
      lowMorganRatio: String(effectiveLowMorganRatio),
      lowOffsetPercent: 0,
      showHigh: settings.showHigh,
      showLow: settings.showLow,
      stochDSmoothing: context.stochDSmoothing,
      stochKSmoothing: context.stochKSmoothing,
      stochLength: context.stochLength,
    },
    symbol: context.symbol,
    timeframe: context.period,
  })
    .then((payload) => createMmfRowsFromMarkers(realRows, payload.markers ?? [], settings))
    .catch(() => createEmptyMmfRows(realRows.length))

  setCachedRemoteMmfRows(signature, request)
  const calculated = await request
  setCachedRemoteMmfRows(signature, calculated)
  return mergeRealRowsWithPlaceholders(dataList, calculated)
}

function drawMmfMarkers({
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: {
  ctx: CanvasRenderingContext2D
  indicator: { calcParams: unknown[]; result: MmfIndicatorRow[] }
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
  yAxis: { convertToPixel: (value: number) => number }
}) {
  const settings = normalizeMmfSettings(indicator.calcParams[0] as Partial<MmfIndicatorSettings>)
  const start = Math.max(0, Math.floor(visibleRange.from) - 2)
  const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 2)

  mmfMarkerSpecs.forEach((spec) => {
    if (!spec.show(settings)) return
    const size = spec.size(settings)
    const offset = spec.yDirection * Math.max(4, Math.round(size * spec.offsetMultiplier))

    ctx.save()
    ctx.fillStyle = spec.color(settings)
    ctx.font = `${size}px Arial, Tahoma, 'Segoe UI Symbol', 'Segoe UI', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = spec.textBaseline

    for (let index = start; index <= end; index += 1) {
      const marker = indicator.result[index]?.[spec.markerKey]
      if (!Number.isFinite(marker)) continue
      const x = xAxis.convertToPixel(index)
      const y = yAxis.convertToPixel(marker as number) + offset
      ctx.fillText(spec.symbol(settings), x, y)
    }

    ctx.restore()
  })
}

function createMmfTooltipValues(
  row: MmfIndicatorRow | undefined,
  settings: MmfIndicatorSettings,
  textColor: string,
) {
  return mmfMarkerSpecs.flatMap((spec) => {
    const price = row?.[spec.priceKey]
    if (!spec.show(settings) || !Number.isFinite(price)) return []
    return [{
      title: { text: spec.title, color: textColor },
      value: { text: String(price), color: spec.color(settings) },
    }]
  })
}

export function ensureTradingViewMmfIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfIndicatorRow>({
    name: 'MMF',
    shortName: 'MMF',
    calcParams: [defaultMmfIndicatorSettings],
    series: IndicatorSeries.Price,
    createTooltipDataSource: (params) => {
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const settings = normalizeMmfSettings(params.indicator.calcParams[0] as Partial<MmfIndicatorSettings>)
      return {
        name: 'MMF',
        calcParamsText: '',
        icons: [],
        values: createMmfTooltipValues(row, settings, params.defaultStyles.tooltip.text.color),
      }
    },
    draw: (params) => {
      drawMmfMarkers(params)
      return true
    },
    calc: (dataList, indicator) => calculateRemoteMmfRows(
      dataList,
      indicator.calcParams[0] as Partial<MmfIndicatorSettings>,
      indicator.calcParams[1],
    ),
  })
}
