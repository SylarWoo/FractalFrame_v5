import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings, defaultMmfIndicatorSettings, defaultVdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MaIndicatorSettings, MmfIndicatorSettings, VdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfV2IndicatorMarkers, type MmfV2IndicatorMarker } from '../../services/mt5/mmfV2IndicatorApi'
import { assignBarKey, createBarIndexResolver, getKLineTimeSeconds } from './barIdentity'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'

export type MmfV2IndicatorRow = {
  highMarker?: number
  highMarkerPrice?: number
  deadCrossMarker?: number
  deadCrossMarkerPrice?: number
  lowMarker?: number
  lowMarkerPrice?: number
  goldenCrossMarker?: number
  goldenCrossMarkerPrice?: number
  highConfirmPointMarker?: number
  highConfirmPointMarkerPrice?: number
  highConfirmPointDistance?: number
  resistanceMarker?: number
  resistanceMarkerPrice?: number
  lowConfirmPointMarker?: number
  lowConfirmPointMarkerPrice?: number
  lowConfirmPointDistance?: number
  supportMarker?: number
  supportMarkerPrice?: number
}

type MmfV2CalcContext = {
  maSettings?: Partial<MaIndicatorSettings>
  period?: string
  settings?: Partial<MmfIndicatorSettings>
  symbol?: string
  vdoSettings?: Partial<VdoIndicatorSettings>
}

type MmfV2MarkerSpec = {
  color: (settings: MmfIndicatorSettings) => string
  distanceKey?: keyof Pick<MmfV2IndicatorRow, 'highConfirmPointDistance' | 'lowConfirmPointDistance'>
  markerKey: keyof Pick<MmfV2IndicatorRow, 'highMarker' | 'deadCrossMarker' | 'lowMarker' | 'goldenCrossMarker' | 'highConfirmPointMarker' | 'lowConfirmPointMarker' | 'supportMarker' | 'resistanceMarker'>
  markerType: MmfV2IndicatorMarker['type']
  offsetMultiplier: number
  priceKey: keyof Pick<MmfV2IndicatorRow, 'highMarkerPrice' | 'deadCrossMarkerPrice' | 'lowMarkerPrice' | 'goldenCrossMarkerPrice' | 'highConfirmPointMarkerPrice' | 'lowConfirmPointMarkerPrice' | 'supportMarkerPrice' | 'resistanceMarkerPrice'>
  show: (settings: MmfIndicatorSettings) => boolean
  size: (settings: MmfIndicatorSettings) => number
  symbol: (settings: MmfIndicatorSettings) => string
  textBaseline: CanvasTextBaseline
  title: string
  yDirection: -1 | 1
}

let registered = false
const mmfV2EngineVersion = 'mmf-v2-support-resistance-v1'
const remoteMmfV2RowsBySignature = new Map<string, Promise<MmfV2IndicatorRow[]> | MmfV2IndicatorRow[]>()
const mmfV2InternalStochSettings = {
  dSmoothing: 6,
  kSmoothing: 6,
  length: 28,
}

const mmfV2MarkerSpecs: MmfV2MarkerSpec[] = [
  {
    color: (settings) => settings.deadCrossColor || defaultMmfIndicatorSettings.deadCrossColor,
    markerKey: 'deadCrossMarker',
    markerType: 'MMF_V2_HIGH',
    offsetMultiplier: 0.55,
    priceKey: 'deadCrossMarkerPrice',
    show: (settings) => settings.showDeadCross,
    size: (settings) => clampMarkerSize(settings.deadCrossSize, defaultMmfIndicatorSettings.deadCrossSize),
    symbol: (settings) => settings.deadCrossSymbol || defaultMmfIndicatorSettings.deadCrossSymbol,
    textBaseline: 'bottom',
    title: '\u6b7b\u53c9 ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.highColor || defaultMmfIndicatorSettings.highColor,
    markerKey: 'highMarker',
    markerType: 'MMF_V2_HIGH',
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
    color: (settings) => settings.resistanceColor || defaultMmfIndicatorSettings.resistanceColor,
    markerKey: 'resistanceMarker',
    markerType: 'MMF_V2_RESISTANCE',
    offsetMultiplier: 0.25,
    priceKey: 'resistanceMarkerPrice',
    show: (settings) => settings.showResistanceLevel,
    size: (settings) => clampMarkerSize(settings.resistanceSize, defaultMmfIndicatorSettings.resistanceSize),
    symbol: (settings) => settings.resistanceSymbol || defaultMmfIndicatorSettings.resistanceSymbol,
    textBaseline: 'bottom',
    title: '\u963b\u529b\u4f4d ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.goldenCrossColor || defaultMmfIndicatorSettings.goldenCrossColor,
    markerKey: 'goldenCrossMarker',
    markerType: 'MMF_V2_LOW',
    offsetMultiplier: 0.55,
    priceKey: 'goldenCrossMarkerPrice',
    show: (settings) => settings.showGoldenCross,
    size: (settings) => clampMarkerSize(settings.goldenCrossSize, defaultMmfIndicatorSettings.goldenCrossSize),
    symbol: (settings) => settings.goldenCrossSymbol || defaultMmfIndicatorSettings.goldenCrossSymbol,
    textBaseline: 'top',
    title: '\u91d1\u53c9 ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.highConfirmPointColor || defaultMmfIndicatorSettings.highConfirmPointColor,
    distanceKey: 'highConfirmPointDistance',
    markerKey: 'highConfirmPointMarker',
    markerType: 'MMF_V2_HIGH',
    offsetMultiplier: 0.75,
    priceKey: 'highConfirmPointMarkerPrice',
    show: (settings) => settings.showHighConfirmPoint,
    size: (settings) => clampMarkerSize(settings.highConfirmPointSize, defaultMmfIndicatorSettings.highConfirmPointSize),
    symbol: (settings) => settings.highConfirmPointSymbol || defaultMmfIndicatorSettings.highConfirmPointSymbol,
    textBaseline: 'bottom',
    title: '\u9ad8\u70b9\u786e\u8ba4\u70b9 ',
    yDirection: -1,
  },
  {
    color: (settings) => settings.lowColor || defaultMmfIndicatorSettings.lowColor,
    markerKey: 'lowMarker',
    markerType: 'MMF_V2_LOW',
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
    color: (settings) => settings.supportColor || defaultMmfIndicatorSettings.supportColor,
    markerKey: 'supportMarker',
    markerType: 'MMF_V2_SUPPORT',
    offsetMultiplier: 0.25,
    priceKey: 'supportMarkerPrice',
    show: (settings) => settings.showSupportLevel,
    size: (settings) => clampMarkerSize(settings.supportSize, defaultMmfIndicatorSettings.supportSize),
    symbol: (settings) => settings.supportSymbol || defaultMmfIndicatorSettings.supportSymbol,
    textBaseline: 'top',
    title: '\u652f\u6491\u4f4d ',
    yDirection: 1,
  },
  {
    color: (settings) => settings.lowConfirmPointColor || defaultMmfIndicatorSettings.lowConfirmPointColor,
    distanceKey: 'lowConfirmPointDistance',
    markerKey: 'lowConfirmPointMarker',
    markerType: 'MMF_V2_LOW',
    offsetMultiplier: 0.75,
    priceKey: 'lowConfirmPointMarkerPrice',
    show: (settings) => settings.showLowConfirmPoint,
    size: (settings) => clampMarkerSize(settings.lowConfirmPointSize, defaultMmfIndicatorSettings.lowConfirmPointSize),
    symbol: (settings) => settings.lowConfirmPointSymbol || defaultMmfIndicatorSettings.lowConfirmPointSymbol,
    textBaseline: 'top',
    title: '\u4f4e\u70b9\u786e\u8ba4\u70b9 ',
    yDirection: 1,
  },
]

function normalizeMmfSettings(input?: Partial<MmfIndicatorSettings>): MmfIndicatorSettings {
  const legacy = (input ?? {}) as Partial<Record<string, unknown>>
  return {
    ...defaultMmfIndicatorSettings,
    ...(input ?? {}),
    highConfirmPointColor: typeof legacy.highConfirmPointColor === 'string' ? legacy.highConfirmPointColor : typeof legacy.sellColor === 'string' ? legacy.sellColor : defaultMmfIndicatorSettings.highConfirmPointColor,
    highConfirmPointSize: Number.isFinite(Number(legacy.highConfirmPointSize)) ? Number(legacy.highConfirmPointSize) : Number.isFinite(Number(legacy.sellSize)) ? Number(legacy.sellSize) : defaultMmfIndicatorSettings.highConfirmPointSize,
    highConfirmPointSymbol: typeof legacy.highConfirmPointSymbol === 'string' ? legacy.highConfirmPointSymbol : typeof legacy.sellSymbol === 'string' ? legacy.sellSymbol : defaultMmfIndicatorSettings.highConfirmPointSymbol,
    lowConfirmPointColor: typeof legacy.lowConfirmPointColor === 'string' ? legacy.lowConfirmPointColor : typeof legacy.buyColor === 'string' ? legacy.buyColor : defaultMmfIndicatorSettings.lowConfirmPointColor,
    lowConfirmPointSize: Number.isFinite(Number(legacy.lowConfirmPointSize)) ? Number(legacy.lowConfirmPointSize) : Number.isFinite(Number(legacy.buySize)) ? Number(legacy.buySize) : defaultMmfIndicatorSettings.lowConfirmPointSize,
    lowConfirmPointSymbol: typeof legacy.lowConfirmPointSymbol === 'string' ? legacy.lowConfirmPointSymbol : typeof legacy.buySymbol === 'string' ? legacy.buySymbol : defaultMmfIndicatorSettings.lowConfirmPointSymbol,
    showHighConfirmPoint: typeof legacy.showHighConfirmPoint === 'boolean' ? legacy.showHighConfirmPoint : legacy.showSell !== false,
    showLowConfirmPoint: typeof legacy.showLowConfirmPoint === 'boolean' ? legacy.showLowConfirmPoint : legacy.showBuy !== false,
  }
}

function normalizeStoreTimeframe(period?: string) {
  const value = String(period || 'M5').trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value.endsWith('M') && value !== 'MN1') return `M${value.slice(0, -1)}`
  if (value.endsWith('H')) return `H${value.slice(0, -1)}`
  return value
}

function normalizePositiveInteger(value: unknown, fallback: number, minimum = 1) {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.max(minimum, Math.min(number, 500)) : fallback
}

function normalizeMmfV2Context(input: unknown) {
  const context = input && typeof input === 'object' ? input as MmfV2CalcContext : {}
  const vdoSettings = { ...defaultVdoIndicatorSettings, ...(context.vdoSettings ?? {}) }
  const maSettings = { ...defaultMaIndicatorSettings, ...(context.maSettings ?? {}) }
  return {
    maSettings,
    period: normalizeStoreTimeframe(context.period),
    settings: normalizeMmfSettings(context.settings),
    stochSettings: mmfV2InternalStochSettings,
    symbol: typeof context.symbol === 'string' && context.symbol.trim() ? context.symbol.trim() : '',
    vdoSettings,
  }
}

function createEmptyMmfV2Rows(length: number): MmfV2IndicatorRow[] {
  return Array.from({ length }, () => ({}))
}

function mergeRealRowsWithPlaceholders(dataList: KLineData[], realRows: MmfV2IndicatorRow[]) {
  const rows: MmfV2IndicatorRow[] = []
  let realIndex = 0
  for (const row of dataList) {
    if (isFuturePlaceholder(row)) {
      rows.push({})
      continue
    }
    rows.push(realRows[realIndex] ?? {})
    realIndex += 1
  }
  return rows
}

function createRemoteMmfV2Signature(realRows: KLineData[], context: ReturnType<typeof normalizeMmfV2Context>) {
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    mmfV2EngineVersion,
    context.symbol,
    context.period,
    realRows.length,
    first?.timestamp,
    last?.timestamp,
    last?.close,
    context.stochSettings.length,
    context.stochSettings.kSmoothing,
    context.stochSettings.dSmoothing,
    context.settings.showHigh,
    context.settings.showLow,
    context.settings.showSupportLevel,
    context.settings.showResistanceLevel,
    context.settings.showDeadCross,
    context.settings.showGoldenCross,
    context.settings.showHighConfirmPoint,
    context.settings.showLowConfirmPoint,
    context.settings.highSymbol,
    context.settings.highSize,
    context.settings.highColor,
    context.settings.deadCrossSymbol,
    context.settings.deadCrossSize,
    context.settings.deadCrossColor,
    context.settings.highAnchorLookbackBars,
    context.settings.highStochKAdvance,
    context.settings.highConfirmLookaheadBars,
    context.settings.highConfirmPointSymbol,
    context.settings.highConfirmPointSize,
    context.settings.highConfirmPointColor,
    context.settings.lowSymbol,
    context.settings.lowSize,
    context.settings.lowColor,
    context.settings.goldenCrossSymbol,
    context.settings.goldenCrossSize,
    context.settings.goldenCrossColor,
    context.settings.lowAnchorLookbackBars,
    context.settings.lowStochKAdvance,
    context.settings.lowConfirmLookaheadBars,
    context.settings.lowConfirmPointSymbol,
    context.settings.lowConfirmPointSize,
    context.settings.lowConfirmPointColor,
    context.settings.supportSymbol,
    context.settings.supportSize,
    context.settings.supportColor,
    context.settings.resistanceSymbol,
    context.settings.resistanceSize,
    context.settings.resistanceColor,
    context.vdoSettings.length,
    context.vdoSettings.emaSmoothing,
    context.vdoSettings.zeroLineValue,
    context.vdoSettings.upLineValue,
    context.vdoSettings.upLine2Value,
    context.vdoSettings.downLineValue,
    context.vdoSettings.downLine2Value,
    context.maSettings.length,
    context.maSettings.type,
    context.maSettings.source,
  ].join('|')
}

function getCachedRemoteMmfV2Rows(signature: string) {
  const cached = remoteMmfV2RowsBySignature.get(signature)
  if (cached) {
    remoteMmfV2RowsBySignature.delete(signature)
    remoteMmfV2RowsBySignature.set(signature, cached)
  }
  return cached
}

function setCachedRemoteMmfV2Rows(signature: string, rows: Promise<MmfV2IndicatorRow[]> | MmfV2IndicatorRow[]) {
  remoteMmfV2RowsBySignature.set(signature, rows)
  while (remoteMmfV2RowsBySignature.size > 24) {
    const oldest = remoteMmfV2RowsBySignature.keys().next().value
    if (oldest == null) break
    remoteMmfV2RowsBySignature.delete(oldest)
  }
}

export function createMmfV2RowsFromMarkers(realRows: KLineData[], markers: MmfV2IndicatorMarker[]) {
  const rows = createEmptyMmfV2Rows(realRows.length)
  const resolveRowIndex = createBarIndexResolver(realRows)

  markers.forEach((marker) => {
    const index = resolveRowIndex(marker.markerBarKey, marker.time, marker.index ?? marker.markerIndex)
    const price = Number(marker.price)
    if (!Number.isFinite(index) || index < 0 || index >= rows.length || !Number.isFinite(price)) return
    const entryIndex = resolveRowIndex(marker.entryBarKey ?? marker.confirmBarKey, marker.entryTime ?? marker.confirmTime, marker.entryIndex ?? marker.confirmIndex)
    const eventIndex = resolveRowIndex(marker.eventBarKey, marker.eventTime, marker.eventIndex)
    const entryPrice = Number(marker.entryPrice)
    const pointDistance = Number(marker.pointDistance)
    if (marker.type === 'MMF_V2_HIGH' || marker.type === 'MMF_V2_RESISTANCE') {
      const markerPatch = marker.type === 'MMF_V2_RESISTANCE'
        ? { resistanceMarker: price, resistanceMarkerPrice: price }
        : { highMarker: price, highMarkerPrice: price }
      rows[index] = { ...rows[index], ...markerPatch }
      if (Number.isFinite(eventIndex) && eventIndex >= 0 && eventIndex < rows.length) {
        const deadCrossY = Number(realRows[eventIndex]?.high)
        rows[eventIndex] = {
          ...rows[eventIndex],
          deadCrossMarker: Number.isFinite(deadCrossY) ? deadCrossY : price,
          deadCrossMarkerPrice: Number.isFinite(deadCrossY) ? deadCrossY : price,
        }
      }
      if (Number.isFinite(entryIndex) && entryIndex >= 0 && entryIndex < rows.length && Number.isFinite(entryPrice)) {
        const highConfirmPointY = Number(realRows[entryIndex]?.high)
        rows[entryIndex] = {
          ...rows[entryIndex],
          highConfirmPointMarker: Number.isFinite(highConfirmPointY) ? highConfirmPointY : entryPrice,
          highConfirmPointMarkerPrice: entryPrice,
          highConfirmPointDistance: pointDistance,
        }
      }
    }
    if (marker.type === 'MMF_V2_LOW' || marker.type === 'MMF_V2_SUPPORT') {
      const markerPatch = marker.type === 'MMF_V2_SUPPORT'
        ? { supportMarker: price, supportMarkerPrice: price }
        : { lowMarker: price, lowMarkerPrice: price }
      rows[index] = { ...rows[index], ...markerPatch }
      if (Number.isFinite(eventIndex) && eventIndex >= 0 && eventIndex < rows.length) {
        const goldenCrossY = Number(realRows[eventIndex]?.low)
        rows[eventIndex] = {
          ...rows[eventIndex],
          goldenCrossMarker: Number.isFinite(goldenCrossY) ? goldenCrossY : price,
          goldenCrossMarkerPrice: Number.isFinite(goldenCrossY) ? goldenCrossY : price,
        }
      }
      if (Number.isFinite(entryIndex) && entryIndex >= 0 && entryIndex < rows.length && Number.isFinite(entryPrice)) {
        const lowConfirmPointY = Number(realRows[entryIndex]?.low)
        rows[entryIndex] = {
          ...rows[entryIndex],
          lowConfirmPointMarker: Number.isFinite(lowConfirmPointY) ? lowConfirmPointY : entryPrice,
          lowConfirmPointMarkerPrice: entryPrice,
          lowConfirmPointDistance: pointDistance,
        }
      }
    }
  })
  return rows
}

async function calculateRemoteMmfV2Rows(dataList: KLineData[], inputContext?: unknown): Promise<MmfV2IndicatorRow[]> {
  const context = normalizeMmfV2Context(inputContext)
  const realRows = stripFuturePlaceholders(dataList)
  if (!context.symbol || realRows.length === 0) return mergeRealRowsWithPlaceholders(dataList, createEmptyMmfV2Rows(realRows.length))
  const calculationRows = realRows.length > 1 ? realRows.slice(0, -1) : realRows

  const signature = createRemoteMmfV2Signature(calculationRows, context)
  const cached = getCachedRemoteMmfV2Rows(signature)
  if (cached) return mergeRealRowsWithPlaceholders(dataList, await cached)

  const rows = calculationRows.map((row, sourceIndex) => {
    const time = getKLineTimeSeconds(row)
    const barKey = assignBarKey(row, context.symbol, context.period)
    return {
      barKey,
      close: Number(row.close),
      high: Number(row.high),
      low: Number(row.low),
      open: Number(row.open),
      sourceIndex,
      time,
      volume: Number(row.volume ?? 0),
    }
  }).filter((row) => (
    Number.isFinite(row.time) &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close)
  ))

  const request = calculateMmfV2IndicatorMarkers({
    rows,
    settings: {
      ma: {
        length: normalizePositiveInteger(context.maSettings.length, defaultMaIndicatorSettings.length),
        source: context.maSettings.source,
        type: context.maSettings.type,
      },
      morgan: {
        anchor: 'h4',
        ratios: [-0.236, -0.118, 0.118, 0.236],
      },
      stoch: {
        dSmoothing: normalizePositiveInteger(context.stochSettings.dSmoothing, mmfV2InternalStochSettings.dSmoothing),
        kSmoothing: normalizePositiveInteger(context.stochSettings.kSmoothing, mmfV2InternalStochSettings.kSmoothing),
        length: normalizePositiveInteger(context.stochSettings.length, mmfV2InternalStochSettings.length),
      },
      showHigh: context.settings.showHigh,
      showResistanceLevel: context.settings.showResistanceLevel,
      highAnchorLookbackBars: context.settings.highAnchorLookbackBars,
      highStochKAdvance: context.settings.highStochKAdvance,
      highConfirmLookaheadBars: context.settings.highConfirmLookaheadBars,
      showLow: context.settings.showLow,
      showSupportLevel: context.settings.showSupportLevel,
      lowAnchorLookbackBars: context.settings.lowAnchorLookbackBars,
      lowStochKAdvance: context.settings.lowStochKAdvance,
      lowConfirmLookaheadBars: context.settings.lowConfirmLookaheadBars,
      vdo: {
        downLine2Value: Number(context.vdoSettings.downLine2Value ?? defaultVdoIndicatorSettings.downLine2Value),
        downLineValue: Number(context.vdoSettings.downLineValue ?? defaultVdoIndicatorSettings.downLineValue),
        emaSmoothing: normalizePositiveInteger(context.vdoSettings.emaSmoothing, defaultVdoIndicatorSettings.emaSmoothing, 0),
        length: normalizePositiveInteger(context.vdoSettings.length, defaultVdoIndicatorSettings.length),
        upLine2Value: Number(context.vdoSettings.upLine2Value ?? defaultVdoIndicatorSettings.upLine2Value),
        upLineValue: Number(context.vdoSettings.upLineValue ?? defaultVdoIndicatorSettings.upLineValue),
        zeroLineValue: Number(context.vdoSettings.zeroLineValue ?? defaultVdoIndicatorSettings.zeroLineValue),
      },
    },
    symbol: context.symbol,
    timeframe: context.period,
  })
    .then((payload) => {
      const markers = payload.markers ?? []
      return createMmfV2RowsFromMarkers(realRows, markers)
    })
    .catch(() => createEmptyMmfV2Rows(realRows.length))

  setCachedRemoteMmfV2Rows(signature, request)
  const calculated = await request
  setCachedRemoteMmfV2Rows(signature, calculated)
  return mergeRealRowsWithPlaceholders(dataList, calculated)
}

function clampMarkerSize(value: unknown, fallback = defaultMmfIndicatorSettings.highSize) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : fallback
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MmfV2IndicatorRow>) {
  const crosshairIndex = Number(params.crosshair?.dataIndex)
  if (Number.isFinite(crosshairIndex)) return Math.max(0, Math.min(params.indicator.result.length - 1, Math.round(crosshairIndex)))
  return Math.max(0, params.indicator.result.length - 1)
}

function resolveMmfV2SymbolOffsetScale(symbol: string) {
  if (['\u25cf', '\u25cb', '\u25a0', '\u25a1'].includes(symbol)) return 0.78
  return 1
}

function resolveMmfV2BaseMarkerOffset(size: number, offsetMultiplier: number, symbol: string) {
  const scale = resolveMmfV2SymbolOffsetScale(symbol)
  return Math.max(4, Math.round(size * offsetMultiplier * scale))
}

function resolveMmfV2MarkerOffset(size: number, direction: -1 | 1, stackIndex: number, baseOffset: number) {
  const stackOffset = stackIndex <= 1
    ? Math.round(size * 0.9 * stackIndex)
    : Math.round(size * (0.9 + 0.68 * (stackIndex - 1)))
  return direction * (baseOffset + stackOffset)
}

function drawMmfV2Markers({
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: {
  ctx: CanvasRenderingContext2D
  indicator: { calcParams: unknown[]; result: MmfV2IndicatorRow[] }
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
  yAxis: { convertToPixel: (value: number) => number }
}) {
  const context = normalizeMmfV2Context(indicator.calcParams[0])
  const settings = context.settings
  const start = Math.max(0, Math.floor(visibleRange.from) - 2)
  const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 2)
  const visibleSpecs = mmfV2MarkerSpecs.filter((spec) => spec.show(settings))

  for (let index = start; index <= end; index += 1) {
    const row = indicator.result[index]
    if (!row) continue
    const directionCounts: Record<-1 | 1, number> = { [-1]: 0, 1: 0 }
    const directionBaseOffsets: Record<-1 | 1, number> = { [-1]: 0, 1: 0 }
    visibleSpecs.forEach((spec) => {
      const marker = row[spec.markerKey]
      if (!Number.isFinite(marker)) return
      const size = spec.size(settings)
      const symbol = spec.symbol(settings)
      const stackIndex = directionCounts[spec.yDirection]
      directionCounts[spec.yDirection] += 1
      if (directionBaseOffsets[spec.yDirection] === 0) {
        directionBaseOffsets[spec.yDirection] = resolveMmfV2BaseMarkerOffset(size, spec.offsetMultiplier, symbol)
      }
      const offset = resolveMmfV2MarkerOffset(size, spec.yDirection, stackIndex, directionBaseOffsets[spec.yDirection])
      const x = xAxis.convertToPixel(index)
      const y = yAxis.convertToPixel(marker as number) + offset

      ctx.save()
      ctx.fillStyle = spec.color(settings)
      ctx.font = `${size}px Arial, Tahoma, 'Segoe UI Symbol', 'Segoe UI', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = spec.textBaseline
      ctx.fillText(symbol, x, y)
      ctx.restore()
    })
  }
}

function createMmfV2TooltipValues(row: MmfV2IndicatorRow | undefined, settings: MmfIndicatorSettings, textColor: string) {
  return mmfV2MarkerSpecs.flatMap((spec) => {
    const price = row?.[spec.priceKey]
    if (!spec.show(settings) || !Number.isFinite(price)) return []
    const distance = spec.distanceKey ? row?.[spec.distanceKey] : undefined
    return [{
      title: { text: spec.title, color: textColor },
      value: { text: String(price), color: spec.color(settings) },
    }, ...(Number.isFinite(distance) ? [{
      title: { text: '\u8ddd\u79bb ', color: textColor },
      value: { text: formatMmfV2PointDistance(distance), color: spec.color(settings) },
    }] : [])]
  })
}

function formatMmfV2PointDistance(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return number.toFixed(2).replace(/\.?0+$/, '')
}

export function ensureTradingViewMmfV2Indicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfV2IndicatorRow>({
    name: 'MMF_V2',
    shortName: 'MMF v2',
    calcParams: [{ settings: defaultMmfIndicatorSettings }],
    series: IndicatorSeries.Price,
    createTooltipDataSource: (params) => {
      const context = normalizeMmfV2Context(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      return {
        name: 'MMF v2',
        calcParamsText: '',
        icons: [],
        values: createMmfV2TooltipValues(row, context.settings, params.defaultStyles.tooltip.text.color),
      }
    },
    draw: (params) => {
      drawMmfV2Markers(params)
      return true
    },
    calc: (dataList, indicator) => calculateRemoteMmfV2Rows(dataList, indicator.calcParams[0]),
  })
}

