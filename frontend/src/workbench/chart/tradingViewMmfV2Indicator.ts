import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings, defaultMmfIndicatorSettings, defaultStochIndicatorSettings, defaultTsiIndicatorSettings, defaultVdoIndicatorSettings, defaultVmiIndicatorSettings, defaultVwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfV2IndicatorMarkers } from '../../services/mt5/mmfV2IndicatorApi'
import { assignBarKey, getKLineTimeSeconds } from './barIdentity'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { createEmptyMmfV2Rows, createMmfV2RowsFromMarkers as createRowsFromMarkers } from './mmfV2MarkerMapping'
import { mmfV2MarkerSpecs } from './mmfV2MarkerSpecs'
import type { MmfV2CalcContext, MmfV2IndicatorRow } from './mmfV2Types'

export type { MmfV2IndicatorRow } from './mmfV2Types'
export { createMmfV2RowsFromMarkers } from './mmfV2MarkerMapping'

let registered = false
const mmfV2EngineVersion = 'mmf-v2-tsi-confirmed-cross-only-v2'
const defaultRemoteMmfV2CalculationRows = 8000
const defaultRemoteMmfV2IncrementalRows = 1600
const remoteMmfV2RowsBySignature = new Map<string, Promise<MmfV2IndicatorRow[]> | MmfV2IndicatorRow[]>()
type LastRemoteMmfV2Result = {
  firstTimestamp?: unknown
  lastTimestamp?: unknown
  resultRows: MmfV2IndicatorRow[]
  rowsLength: number
  settingsSignature: string
}
const lastRemoteMmfV2ResultBySettings = new Map<string, LastRemoteMmfV2Result>()
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

function resolveRemoteMmfV2CalculationLimits(period: string) {
  if (period === 'M1' || period === 'M5') {
    return {
      calculationRows: 3000,
      incrementalRows: 600,
    }
  }
  if (period === 'M15' || period === 'M30') {
    return {
      calculationRows: 5000,
      incrementalRows: 1000,
    }
  }
  return {
    calculationRows: defaultRemoteMmfV2CalculationRows,
    incrementalRows: defaultRemoteMmfV2IncrementalRows,
  }
}

function normalizeMmfV2Context(input: unknown) {
  const context = input && typeof input === 'object' ? input as MmfV2CalcContext : {}
  const stochSettings = { ...defaultStochIndicatorSettings, ...(context.stochSettings ?? {}) }
  const vdoSettings = { ...defaultVdoIndicatorSettings, ...(context.vdoSettings ?? {}) }
  const vmiSettings = { ...defaultVmiIndicatorSettings, ...(context.vmiSettings ?? {}) }
  const tsiSettings = { ...defaultTsiIndicatorSettings, ...(context.tsiSettings ?? {}) }
  const vwapSettings = { ...defaultVwapIndicatorSettings, ...(context.vwapSettings ?? {}) }
  return {
    maSettings: { ...defaultMaIndicatorSettings, ...mmfV2InternalMaSettings, ...(context.maSettings ?? {}) },
    morganRangeMode: context.morganRangeMode === 'D1_M30' ? 'D1_M30' : 'H4_M5',
    period: normalizeStoreTimeframe(context.period),
    settings: normalizeMmfSettings(context.settings),
    stochSettings,
    symbol: typeof context.symbol === 'string' && context.symbol.trim() ? context.symbol.trim() : '',
    vdoSettings,
    vmiSettings,
    tsiSettings,
    vwapSettings,
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

function createRemoteMmfV2SettingsSignature(context: ReturnType<typeof normalizeMmfV2Context>) {
  return [
    mmfV2EngineVersion,
    context.symbol,
    context.period,
    context.stochSettings.length,
    context.stochSettings.kSmoothing,
    context.stochSettings.dSmoothing,
    context.settings.showHigh,
    context.settings.showLow,
    context.settings.showSupportLevel,
    context.settings.showResistanceLevel,
    context.settings.showTopDivergencePoint,
    context.settings.showBottomDivergencePoint,
    context.settings.showTrendDownReboundPoint,
    context.settings.showTrendUpPullbackPoint,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    context.settings.showBullMarketPoint,
    context.settings.showBearMarketPoint,
    context.settings.showOverboughtPoint,
    context.settings.showOverboughtClosePoint,
    context.settings.showOversoldPoint,
    context.settings.showOversoldClosePoint,
    context.settings.showTsiDeadCrossPoint,
    context.settings.showTsiDeadCrossConfirmPoint,
    context.settings.tsiDeadCrossConfirmDistance,
    context.settings.showTsiGoldenCrossPoint,
    context.settings.showTsiGoldenCrossConfirmPoint,
    context.settings.tsiGoldenCrossConfirmDistance,
    context.settings.highAnchorLookbackBars,
    context.settings.highStochKAdvance,
    context.settings.highConfirmLookaheadBars,
    context.settings.lowAnchorLookbackBars,
    context.settings.lowStochKAdvance,
    context.settings.lowConfirmLookaheadBars,
    0,
    0,
    0,
    0,
    0,
    0,
    context.vdoSettings.length,
    context.vdoSettings.emaSmoothing,
    context.vdoSettings.zeroLineValue,
    context.vdoSettings.upLineValue,
    context.vdoSettings.upLine2Value,
    context.vdoSettings.upLine3Value,
    context.vdoSettings.downLineValue,
    context.vdoSettings.downLine2Value,
    context.vdoSettings.downLine3Value,
    context.vdoSettings.vdoMaLength,
    context.vdoSettings.vdoMa2Length,
    context.vmiSettings.fastLength,
    context.vmiSettings.slowLength,
    context.tsiSettings.longLength,
    context.tsiSettings.shortLength,
    context.tsiSettings.signalLength,
    context.maSettings.length,
    context.maSettings.type,
    context.maSettings.source,
    context.vwapSettings.anchorPeriod,
    context.vwapSettings.source,
    context.vwapSettings.bandCalculationMode,
    context.vwapSettings.band1Multiplier,
    context.vwapSettings.offset,
    context.morganRangeMode,
  ].join('|')
}

function getLastRemoteMmfV2Result(settingsSignature: string) {
  const cached = lastRemoteMmfV2ResultBySettings.get(settingsSignature)
  if (cached) {
    lastRemoteMmfV2ResultBySettings.delete(settingsSignature)
    lastRemoteMmfV2ResultBySettings.set(settingsSignature, cached)
  }
  return cached ?? null
}

function setLastRemoteMmfV2Result(settingsSignature: string, result: LastRemoteMmfV2Result) {
  lastRemoteMmfV2ResultBySettings.set(settingsSignature, result)
  while (lastRemoteMmfV2ResultBySettings.size > 12) {
    const oldest = lastRemoteMmfV2ResultBySettings.keys().next().value
    if (oldest == null) break
    lastRemoteMmfV2ResultBySettings.delete(oldest)
  }
}

function createRemoteMmfV2Signature(realRows: KLineData[], context: ReturnType<typeof normalizeMmfV2Context>, sourceOffset: number, mode: 'full' | 'incremental') {
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    createRemoteMmfV2SettingsSignature(context),
    mode,
    sourceOffset,
    realRows.length,
    first?.timestamp,
    last?.timestamp,
    last?.close,
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
  const allCalculationRows = realRows.length > 1 ? realRows.slice(0, -1) : realRows
  const settingsSignature = createRemoteMmfV2SettingsSignature(context)
  const previous = getLastRemoteMmfV2Result(settingsSignature)
  const calculationLimits = resolveRemoteMmfV2CalculationLimits(context.period)
  const canUseIncrementalTail = Boolean(
    previous &&
    previous.settingsSignature === settingsSignature &&
    previous.rowsLength > 0 &&
    allCalculationRows.length > previous.rowsLength &&
    allCalculationRows[0]?.timestamp === previous.firstTimestamp &&
    allCalculationRows[previous.rowsLength - 1]?.timestamp === previous.lastTimestamp,
  )
  const incrementalTailStart = canUseIncrementalTail
    ? Math.max(0, allCalculationRows.length - calculationLimits.incrementalRows)
    : 0
  const skippedRows = canUseIncrementalTail && previous && previous.resultRows.length >= incrementalTailStart
    ? incrementalTailStart
    : Math.max(0, allCalculationRows.length - calculationLimits.calculationRows)
  const calculationMode: 'full' | 'incremental' = skippedRows === incrementalTailStart && canUseIncrementalTail ? 'incremental' : 'full'
  const calculationRows = allCalculationRows.slice(skippedRows)

  const signature = createRemoteMmfV2Signature(calculationRows, context, skippedRows, calculationMode)
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
      sourceIndex: skippedRows + sourceIndex,
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
    includeSignalFrame: false,
    rows,
    settings: {
      ma: {
        length: normalizePositiveInteger(context.maSettings.length, mmfV2InternalMaSettings.length),
        source: context.maSettings.source,
        type: context.maSettings.type,
      },
      morgan: {
        anchor: context.morganRangeMode === 'D1_M30' ? 'd1' : 'h4',
        ratios: [-0.236, -0.118, 0.118, 0.236],
      },
      vwap: {
        anchorPeriod: context.vwapSettings.anchorPeriod,
        bandCalculationMode: context.vwapSettings.bandCalculationMode,
        band1Multiplier: Number(context.vwapSettings.band1Multiplier ?? defaultVwapIndicatorSettings.band1Multiplier),
        offset: Number(context.vwapSettings.offset ?? 0),
        source: context.vwapSettings.source,
        symbol: context.symbol,
      },
      stoch: {
        dSmoothing: normalizePositiveInteger(context.stochSettings.dSmoothing, mmfV2InternalStochSettings.dSmoothing),
        kSmoothing: normalizePositiveInteger(context.stochSettings.kSmoothing, mmfV2InternalStochSettings.kSmoothing),
        length: normalizePositiveInteger(context.stochSettings.length, mmfV2InternalStochSettings.length),
      },
      showHigh: context.settings.showHigh,
      showExpectedResistanceLevel: false,
      showTrendDownReboundPoint: context.settings.showTrendDownReboundPoint,
      showTrendDownReturnPoint: false,
      trendDownReturnMorganRatio: 0,
      showTrendDownDivergencePointV2: false,
      trendDownDivergenceMorganRatio: 0,
      showResistanceLevel: context.settings.showResistanceLevel,
      showTopDivergencePoint: context.settings.showTopDivergencePoint,
      showResistanceDownBreakPoint: false,
      showResistanceUpBreakPoint: false,
      showTrueCloseDownPoint: false,
      showBearMarketPoint: context.settings.showBearMarketPoint,
      trueCloseDownVdoThreshold: 0,
      highAnchorLookbackBars: context.settings.highAnchorLookbackBars,
      highStochKAdvance: context.settings.highStochKAdvance,
      highConfirmLookaheadBars: context.settings.highConfirmLookaheadBars,
      showLow: context.settings.showLow,
      showExpectedSupportLevel: false,
      showTrendUpPullbackPoint: context.settings.showTrendUpPullbackPoint,
      showTrendUpReturnPoint: false,
      trendUpReturnMorganRatio: 0,
      showTrendUpDivergencePointV2: false,
      trendUpDivergenceMorganRatio: 0,
      showSupportLevel: context.settings.showSupportLevel,
      showBottomDivergencePoint: context.settings.showBottomDivergencePoint,
      showSupportDownBreakPoint: false,
      showSupportUpBreakPoint: false,
      showTrueCloseUpPoint: false,
      showBullMarketPoint: context.settings.showBullMarketPoint,
      showOverboughtPoint: context.settings.showOverboughtPoint,
      showOverboughtClosePoint: context.settings.showOverboughtClosePoint,
      showOversoldPoint: context.settings.showOversoldPoint,
      showOversoldClosePoint: context.settings.showOversoldClosePoint,
      showTsiDeadCrossPoint: context.settings.showTsiDeadCrossPoint,
      showTsiDeadCrossConfirmPoint: context.settings.showTsiDeadCrossConfirmPoint,
      tsiDeadCrossConfirmDistance: Number(context.settings.tsiDeadCrossConfirmDistance ?? defaultMmfIndicatorSettings.tsiDeadCrossConfirmDistance),
      showTsiGoldenCrossPoint: context.settings.showTsiGoldenCrossPoint,
      showTsiGoldenCrossConfirmPoint: context.settings.showTsiGoldenCrossConfirmPoint,
      tsiGoldenCrossConfirmDistance: Number(context.settings.tsiGoldenCrossConfirmDistance ?? defaultMmfIndicatorSettings.tsiGoldenCrossConfirmDistance),
      trueCloseUpVdoThreshold: 0,
      lowAnchorLookbackBars: context.settings.lowAnchorLookbackBars,
      lowStochKAdvance: context.settings.lowStochKAdvance,
      lowConfirmLookaheadBars: context.settings.lowConfirmLookaheadBars,
      vdo: {
        downLine2Value: Number(context.vdoSettings.downLine2Value ?? defaultVdoIndicatorSettings.downLine2Value),
        downLine3Value: Number(context.vdoSettings.downLine3Value ?? defaultVdoIndicatorSettings.downLine3Value),
        downLineValue: Number(context.vdoSettings.downLineValue ?? defaultVdoIndicatorSettings.downLineValue),
        emaSmoothing: normalizePositiveInteger(context.vdoSettings.emaSmoothing, defaultVdoIndicatorSettings.emaSmoothing, 0),
        length: normalizePositiveInteger(context.vdoSettings.length, defaultVdoIndicatorSettings.length),
        upLine2Value: Number(context.vdoSettings.upLine2Value ?? defaultVdoIndicatorSettings.upLine2Value),
        upLine3Value: Number(context.vdoSettings.upLine3Value ?? defaultVdoIndicatorSettings.upLine3Value),
        upLineValue: Number(context.vdoSettings.upLineValue ?? defaultVdoIndicatorSettings.upLineValue),
        vdoMaLength: normalizePositiveInteger(context.vdoSettings.vdoMaLength, defaultVdoIndicatorSettings.vdoMaLength),
        vdoMa2Length: normalizePositiveInteger(context.vdoSettings.vdoMa2Length, defaultVdoIndicatorSettings.vdoMa2Length),
        zeroLineValue: Number(context.vdoSettings.zeroLineValue ?? defaultVdoIndicatorSettings.zeroLineValue),
      },
      vmi: {
        fastLength: normalizePositiveInteger(context.vmiSettings.fastLength, defaultVmiIndicatorSettings.fastLength),
        slowLength: normalizePositiveInteger(context.vmiSettings.slowLength, defaultVmiIndicatorSettings.slowLength),
      },
      tsi: {
        longLength: normalizePositiveInteger(context.tsiSettings.longLength, defaultTsiIndicatorSettings.longLength),
        shortLength: normalizePositiveInteger(context.tsiSettings.shortLength, defaultTsiIndicatorSettings.shortLength),
        signalLength: normalizePositiveInteger(context.tsiSettings.signalLength, defaultTsiIndicatorSettings.signalLength),
      },
    },
    symbol: context.symbol,
    timeframe: context.period,
  })
    .then((payload) => {
      const calculatedRows = createRowsFromMarkers(calculationRows, payload.markers ?? [])
      const prefixRows = calculationMode === 'incremental' && previous
        ? previous.resultRows.slice(0, skippedRows)
        : createEmptyMmfV2Rows(skippedRows)
      return [
        ...prefixRows,
        ...calculatedRows,
        ...createEmptyMmfV2Rows(realRows.length - skippedRows - calculatedRows.length),
      ]
    })
    .catch(() => createEmptyMmfV2Rows(realRows.length))

  setCachedRemoteMmfV2Rows(signature, request)
  const calculated = await request
  setCachedRemoteMmfV2Rows(signature, calculated)
  setLastRemoteMmfV2Result(settingsSignature, {
    firstTimestamp: allCalculationRows[0]?.timestamp,
    lastTimestamp: allCalculationRows[allCalculationRows.length - 1]?.timestamp,
    resultRows: calculated,
    rowsLength: allCalculationRows.length,
    settingsSignature,
  })
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
    const stackByDirection: Record<-1 | 1, number> = { [-1]: 0, 1: 0 }
    visibleSpecs.forEach((spec) => {
      const marker = row[spec.markerKey]
      if (!Number.isFinite(marker)) return
      const size = spec.size(settings)
      const symbol = spec.symbol(settings)
      const x = xAxis.convertToPixel(index)
      const stackIndex = stackByDirection[spec.yDirection]
      stackByDirection[spec.yDirection] += 1
      const baseOffset = resolveMmfV2BaseMarkerOffset(size, spec.offsetMultiplier, symbol)
      const offset = resolveMmfV2MarkerOffset(size, spec.yDirection, stackIndex, baseOffset)
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

