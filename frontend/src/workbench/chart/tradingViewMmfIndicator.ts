import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultDpoIndicatorSettings, defaultMmfIndicatorSettings, defaultStochIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfIndicatorMarkers, type MmfIndicatorMarker } from '../../services/mt5/mmfIndicatorApi'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { calculateMmfHighStateMachineRows } from './mmfHighStateMachine'
import { calculateMorganRangeSegments, getMorganRangeLevel } from './morganRangeModel'
import type { MorganRangeSegment } from './morganRangeModel'
import { calculateTradingViewDpoRows } from './tradingViewDpoIndicator'
import { calculateTradingViewStochRows } from './tradingViewStochIndicator'

export type MmfIndicatorRow = {
  highMarker?: number
  highMarkerPrice?: number
  lowMarker?: number
  lowMarkerPrice?: number
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
  markerKey: 'highMarker' | 'lowMarker'
  markerType: MmfIndicatorMarker['type']
  priceKey: 'highMarkerPrice' | 'lowMarkerPrice'
  show: (settings: MmfIndicatorSettings) => boolean
  size: (settings: MmfIndicatorSettings) => number
  symbol: (settings: MmfIndicatorSettings) => string
  textBaseline: CanvasTextBaseline
  title: string
  yDirection: -1 | 1
}

let registered = false
const remoteMmfEngineVersion = 'mmf-engine-v17-stoch-zone-confirm-offset'
const remoteMmfRowsCacheMax = 24
const remoteMmfRowsBySignature = new Map<string, Promise<MmfIndicatorRow[]> | MmfIndicatorRow[]>()

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
    priceKey: 'highMarkerPrice',
    show: (settings) => settings.showHigh,
    size: (settings) => clampMarkerSize(settings.highSize, defaultMmfIndicatorSettings.highSize),
    symbol: (settings) => settings.highSymbol || defaultMmfIndicatorSettings.highSymbol,
    textBaseline: 'bottom',
    title: 'High ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.lowColor || defaultMmfIndicatorSettings.lowColor,
    markerKey: 'lowMarker',
    markerType: 'MMF_LOW',
    priceKey: 'lowMarkerPrice',
    show: (settings) => settings.showLow,
    size: (settings) => clampMarkerSize(settings.lowSize, defaultMmfIndicatorSettings.lowSize),
    symbol: (settings) => settings.lowSymbol || defaultMmfIndicatorSettings.lowSymbol,
    textBaseline: 'top',
    title: 'Low ',
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

function createMmfRowsFromMarkers(realRows: KLineData[], markers: MmfIndicatorMarker[]): MmfIndicatorRow[] {
  const markersByTypeAndTime = new Map<MmfIndicatorMarker['type'], Map<number, number>>()
  mmfMarkerSpecs.forEach((spec) => {
    markersByTypeAndTime.set(spec.markerType, new Map())
  })

  markers.forEach((marker) => {
    const time = Number(marker.time)
    const price = Number(marker.price)
    if (!Number.isFinite(time) || !Number.isFinite(price)) return
    markersByTypeAndTime.get(marker.type)?.set(time, price)
  })

  return realRows.map((row) => {
    const timestamp = Number(row.timestamp)
    const time = Math.floor(timestamp / 1000)
    const output: MmfIndicatorRow = {}
    mmfMarkerSpecs.forEach((spec) => {
      const marker = markersByTypeAndTime.get(spec.markerType)?.get(time)
      if (!Number.isFinite(marker)) return
      output[spec.markerKey] = marker
      output[spec.priceKey] = marker
    })
    return output
  })
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
    settings.dpoValue,
    settings.highMorganRatio,
    settings.highOffsetPercent,
    settings.lowDpoValue,
    settings.lowMorganRatio,
    settings.lowOffsetPercent,
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
    .then((payload) => createMmfRowsFromMarkers(realRows, payload.markers ?? []))
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
    const offset = spec.yDirection * Math.max(4, Math.round(size * 0.25))

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
