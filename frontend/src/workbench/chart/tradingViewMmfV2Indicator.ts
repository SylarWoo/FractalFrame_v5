import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultMmfIndicatorSettings, defaultVdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfV2IndicatorMarkers } from '../../services/mt5/mmfV2IndicatorApi'
import { assignBarKey, getKLineTimeSeconds } from './barIdentity'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { calculateMmfV2MomentumStats, publishMmfV2MomentumStats } from './mmfV2MomentumStats'
import { createEmptyMmfV2Rows, createMmfV2RowsFromMarkers as createRowsFromMarkers } from './mmfV2MarkerMapping'
import { mmfV2MarkerSpecs } from './mmfV2MarkerSpecs'
import type { MmfV2CalcContext, MmfV2IndicatorRow } from './mmfV2Types'
import { calculateTradingViewVdoRows } from './tradingViewVdoIndicator'

export type { MmfV2IndicatorRow } from './mmfV2Types'
export { createMmfV2RowsFromMarkers } from './mmfV2MarkerMapping'

let registered = false
const mmfV2EngineVersion = 'mmf-v2-trend-divergence-v1'
const remoteMmfV2RowsBySignature = new Map<string, Promise<MmfV2IndicatorRow[]> | MmfV2IndicatorRow[]>()
const mmfV2InternalMaSettings = {
  length: 120,
  source: 'hlc3',
  type: 'sma',
}
const mmfV2InternalStochSettings = {
  dSmoothing: 6,
  kSmoothing: 6,
  length: 28,
}

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
  return {
    maSettings: mmfV2InternalMaSettings,
    period: normalizeStoreTimeframe(context.period),
    settings: normalizeMmfSettings(context.settings),
    stochSettings: mmfV2InternalStochSettings,
    symbol: typeof context.symbol === 'string' && context.symbol.trim() ? context.symbol.trim() : '',
    vdoSettings,
  }
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
    context.settings.showExpectedSupportLevel,
    context.settings.showExpectedResistanceLevel,
    context.settings.showTrendDownReboundPoint,
    context.settings.showTrendUpPullbackPoint,
    context.settings.showTrendDownReturnPoint,
    context.settings.showTrendUpReturnPoint,
    context.settings.showTrendDownDivergencePointV2,
    context.settings.showTrendUpDivergencePointV2,
    context.settings.showDeadCross,
    context.settings.showGoldenCross,
    context.settings.showHighConfirmPoint,
    context.settings.showLowConfirmPoint,
    context.settings.showSupportDownBreakPoint,
    context.settings.showSupportUpBreakPoint,
    context.settings.showResistanceDownBreakPoint,
    context.settings.showResistanceUpBreakPoint,
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
    context.settings.expectedSupportSymbol,
    context.settings.expectedSupportSize,
    context.settings.expectedSupportColor,
    context.settings.trendDownReboundSymbol,
    context.settings.trendDownReboundSize,
    context.settings.trendDownReboundColor,
    context.settings.trendDownReturnSymbol,
    context.settings.trendDownReturnSize,
    context.settings.trendDownReturnColor,
    context.settings.trendDownReturnMorganRatio,
    context.settings.trendDownDivergencePointSymbol,
    context.settings.trendDownDivergencePointSize,
    context.settings.trendDownDivergencePointColor,
    context.settings.trendDownDivergenceMorganRatio,
    context.settings.trendUpPullbackSymbol,
    context.settings.trendUpPullbackSize,
    context.settings.trendUpPullbackColor,
    context.settings.trendUpReturnSymbol,
    context.settings.trendUpReturnSize,
    context.settings.trendUpReturnColor,
    context.settings.trendUpReturnMorganRatio,
    context.settings.trendUpDivergencePointSymbol,
    context.settings.trendUpDivergencePointSize,
    context.settings.trendUpDivergencePointColor,
    context.settings.trendUpDivergenceMorganRatio,
    context.settings.supportDownBreakSymbol,
    context.settings.supportDownBreakSize,
    context.settings.supportDownBreakColor,
    context.settings.supportUpBreakSymbol,
    context.settings.supportUpBreakSize,
    context.settings.supportUpBreakColor,
    context.settings.resistanceSymbol,
    context.settings.resistanceSize,
    context.settings.resistanceColor,
    context.settings.expectedResistanceSymbol,
    context.settings.expectedResistanceSize,
    context.settings.expectedResistanceColor,
    context.settings.resistanceDownBreakSymbol,
    context.settings.resistanceDownBreakSize,
    context.settings.resistanceDownBreakColor,
    context.settings.resistanceUpBreakSymbol,
    context.settings.resistanceUpBreakSize,
    context.settings.resistanceUpBreakColor,
    context.settings.vdoBreakoutMomentumDownLookback,
    context.settings.vdoBreakoutMomentumUpLookback,
    context.settings.vdoCloseMomentumDownLookback,
    context.settings.vdoCloseMomentumUpLookback,
    context.settings.vdoMomentumDownLookback,
    context.settings.vdoMomentumUpLookback,
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
        length: mmfV2InternalMaSettings.length,
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
      showExpectedResistanceLevel: context.settings.showExpectedResistanceLevel,
      showTrendDownReboundPoint: context.settings.showTrendDownReboundPoint,
      showTrendDownReturnPoint: context.settings.showTrendDownReturnPoint,
      trendDownReturnMorganRatio: context.settings.trendDownReturnMorganRatio,
      showTrendDownDivergencePointV2: context.settings.showTrendDownDivergencePointV2,
      trendDownDivergenceMorganRatio: context.settings.trendDownDivergenceMorganRatio,
      showResistanceLevel: context.settings.showResistanceLevel,
      showResistanceDownBreakPoint: context.settings.showResistanceDownBreakPoint,
      showResistanceUpBreakPoint: context.settings.showResistanceUpBreakPoint,
      highAnchorLookbackBars: context.settings.highAnchorLookbackBars,
      highStochKAdvance: context.settings.highStochKAdvance,
      highConfirmLookaheadBars: context.settings.highConfirmLookaheadBars,
      showLow: context.settings.showLow,
      showExpectedSupportLevel: context.settings.showExpectedSupportLevel,
      showTrendUpPullbackPoint: context.settings.showTrendUpPullbackPoint,
      showTrendUpReturnPoint: context.settings.showTrendUpReturnPoint,
      trendUpReturnMorganRatio: context.settings.trendUpReturnMorganRatio,
      showTrendUpDivergencePointV2: context.settings.showTrendUpDivergencePointV2,
      trendUpDivergenceMorganRatio: context.settings.trendUpDivergenceMorganRatio,
      showSupportLevel: context.settings.showSupportLevel,
      showSupportDownBreakPoint: context.settings.showSupportDownBreakPoint,
      showSupportUpBreakPoint: context.settings.showSupportUpBreakPoint,
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
      const vdoRows = calculateTradingViewVdoRows(realRows, {
        downLine2Value: Number(context.vdoSettings.downLine2Value ?? defaultVdoIndicatorSettings.downLine2Value),
        downLineValue: Number(context.vdoSettings.downLineValue ?? defaultVdoIndicatorSettings.downLineValue),
        emaSmoothing: normalizePositiveInteger(context.vdoSettings.emaSmoothing, defaultVdoIndicatorSettings.emaSmoothing, 0),
        length: normalizePositiveInteger(context.vdoSettings.length, defaultVdoIndicatorSettings.length),
        upLine2Value: Number(context.vdoSettings.upLine2Value ?? defaultVdoIndicatorSettings.upLine2Value),
        upLineValue: Number(context.vdoSettings.upLineValue ?? defaultVdoIndicatorSettings.upLineValue),
        zeroLineValue: Number(context.vdoSettings.zeroLineValue ?? defaultVdoIndicatorSettings.zeroLineValue),
      })
      publishMmfV2MomentumStats(calculateMmfV2MomentumStats({
        breakoutDownLookback: Number(context.settings.vdoBreakoutMomentumDownLookback),
        breakoutUpLookback: Number(context.settings.vdoBreakoutMomentumUpLookback),
        closeDownLookback: Number(context.settings.vdoCloseMomentumDownLookback),
        closeUpLookback: Number(context.settings.vdoCloseMomentumUpLookback),
        downLookback: Number(context.settings.vdoMomentumDownLookback),
        markers,
        periodSeconds: resolvePeriodSeconds(context.period),
        symbol: context.symbol,
        timeframe: context.period,
        upLookback: Number(context.settings.vdoMomentumUpLookback),
        vdoRows,
      }))
      return createRowsFromMarkers(realRows, markers)
    })
    .catch(() => createEmptyMmfV2Rows(realRows.length))

  setCachedRemoteMmfV2Rows(signature, request)
  const calculated = await request
  setCachedRemoteMmfV2Rows(signature, calculated)
  return mergeRealRowsWithPlaceholders(dataList, calculated)
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

