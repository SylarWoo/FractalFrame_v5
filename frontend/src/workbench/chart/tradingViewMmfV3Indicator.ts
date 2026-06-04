import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings, defaultMmfIndicatorSettings, defaultStochIndicatorSettings, defaultTsiIndicatorSettings, defaultVdoIndicatorSettings, defaultVmiIndicatorSettings, defaultVwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmfIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfV3IndicatorMarkers } from '../../services/mt5/mmfV3IndicatorApi'
import { assignBarKey, getKLineTimeSeconds } from './barIdentity'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'
import { readIndicatorPageSnapshot } from './indicatorPageSnapshotStore'
import { createEmptyMmfV3Rows, createMmfV3RowsFromMarkers as createRowsFromMarkers } from './mmfV3MarkerMapping'
import { mmfV3MarkerSpecs } from './mmfV3MarkerSpecs'
import type { MmfV3CalcContext, MmfV3IndicatorRow } from './mmfV3Types'

export type { MmfV3IndicatorRow } from './mmfV3Types'
export { createMmfV3RowsFromMarkers } from './mmfV3MarkerMapping'

let registered = false
const mmfV3EngineVersion = 'mmf-v3-vmi-zero-sr-v1'
const defaultRemoteMmfV3CalculationRows = 8000
const defaultRemoteMmfV3IncrementalRows = 1600
const remoteMmfV3VisibleWarmupRows = 1000
const remoteMmfV3VisibleForwardRows = 240
const remoteMmfV3RowsBySignature = new Map<string, Promise<MmfV3IndicatorRow[]> | MmfV3IndicatorRow[]>()
const pageMmfV3RowsBySignature = new Map<string, Promise<MmfV3IndicatorRow[]> | MmfV3IndicatorRow[]>()
type LastRemoteMmfV3Result = {
  firstTimestamp?: unknown
  lastTimestamp?: unknown
  resultRows: MmfV3IndicatorRow[]
  rowsLength: number
  settingsSignature: string
}
const lastRemoteMmfV3ResultBySettings = new Map<string, LastRemoteMmfV3Result>()
const mmfV3InternalMaSettings = {
  length: 120,
  source: 'hlc3',
  type: 'sma',
}
const mmfV3InternalStochSettings = {
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

function resolveRemoteMmfV3CalculationLimits(period: string) {
  if (period === 'M1' || period === 'M5') {
    return {
      calculationRows: 6000,
      incrementalRows: 1200,
    }
  }
  if (period === 'M15' || period === 'M30') {
    return {
      calculationRows: 5000,
      incrementalRows: 1000,
    }
  }
  return {
    calculationRows: defaultRemoteMmfV3CalculationRows,
    incrementalRows: defaultRemoteMmfV3IncrementalRows,
  }
}

function normalizeMmfV3Context(input: unknown) {
  const context = input && typeof input === 'object' ? input as MmfV3CalcContext : {}
  const stochSettings = { ...defaultStochIndicatorSettings, ...(context.stochSettings ?? {}) }
  const vdoSettings = { ...defaultVdoIndicatorSettings, ...(context.vdoSettings ?? {}) }
  const vmiSettings = { ...defaultVmiIndicatorSettings, ...(context.vmiSettings ?? {}) }
  const tsiSettings = { ...defaultTsiIndicatorSettings, ...(context.tsiSettings ?? {}) }
  const vwapSettings = { ...defaultVwapIndicatorSettings, ...(context.vwapSettings ?? {}) }
  return {
    maSettings: { ...defaultMaIndicatorSettings, ...mmfV3InternalMaSettings, ...(context.maSettings ?? {}) },
    morganRangeMode: context.morganRangeMode === 'D1_M30' ? 'D1_M30' : 'H4_M5',
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    period: normalizeStoreTimeframe(context.period),
    settings: normalizeMmfSettings(context.settings),
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    staticRows: Array.isArray(context.staticRows) ? context.staticRows : null,
    stochSettings,
    symbol: typeof context.symbol === 'string' && context.symbol.trim() ? context.symbol.trim() : '',
    vdoSettings,
    visibleFrom: Number.isFinite(Number(context.visibleFrom)) ? Math.floor(Number(context.visibleFrom)) : null,
    visibleTo: Number.isFinite(Number(context.visibleTo)) ? Math.ceil(Number(context.visibleTo)) : null,
    vmiSettings,
    tsiSettings,
    vwapSettings,
  }
}

function mergeRealRowsWithPlaceholders(dataList: KLineData[], realRows: MmfV3IndicatorRow[]) {
  const rows: MmfV3IndicatorRow[] = []
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

function createRemoteMmfV3SettingsSignature(context: ReturnType<typeof normalizeMmfV3Context>) {
  return [
    mmfV3EngineVersion,
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
    context.visibleFrom ?? '',
    context.visibleTo ?? '',
  ].join('|')
}

function getLastRemoteMmfV3Result(settingsSignature: string) {
  const cached = lastRemoteMmfV3ResultBySettings.get(settingsSignature)
  if (cached) {
    lastRemoteMmfV3ResultBySettings.delete(settingsSignature)
    lastRemoteMmfV3ResultBySettings.set(settingsSignature, cached)
  }
  return cached ?? null
}

function setLastRemoteMmfV3Result(settingsSignature: string, result: LastRemoteMmfV3Result) {
  lastRemoteMmfV3ResultBySettings.set(settingsSignature, result)
  while (lastRemoteMmfV3ResultBySettings.size > 12) {
    const oldest = lastRemoteMmfV3ResultBySettings.keys().next().value
    if (oldest == null) break
    lastRemoteMmfV3ResultBySettings.delete(oldest)
  }
}

function createRemoteMmfV3Signature(realRows: KLineData[], context: ReturnType<typeof normalizeMmfV3Context>, sourceOffset: number, mode: 'full' | 'incremental') {
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    createRemoteMmfV3SettingsSignature(context),
    mode,
    sourceOffset,
    realRows.length,
    first?.timestamp,
    last?.timestamp,
    last?.close,
  ].join('|')
}

function getCachedRemoteMmfV3Rows(signature: string) {
  const cached = remoteMmfV3RowsBySignature.get(signature)
  if (cached) {
    remoteMmfV3RowsBySignature.delete(signature)
    remoteMmfV3RowsBySignature.set(signature, cached)
  }
  return cached
}

function setCachedRemoteMmfV3Rows(signature: string, rows: Promise<MmfV3IndicatorRow[]> | MmfV3IndicatorRow[]) {
  remoteMmfV3RowsBySignature.set(signature, rows)
  while (remoteMmfV3RowsBySignature.size > 48) {
    const oldest = remoteMmfV3RowsBySignature.keys().next().value
    if (oldest == null) break
    remoteMmfV3RowsBySignature.delete(oldest)
  }
}

function createMmfV3PageDataSignature(dataList: KLineData[]) {
  const realRows = stripFuturePlaceholders(dataList)
  const first = realRows[0]
  const middle = realRows[Math.floor(realRows.length / 2)]
  const previousLast = realRows[realRows.length - 2]
  const last = realRows[realRows.length - 1]
  const rowSignature = (row: KLineData | undefined) => row
    ? [row.timestamp, row.open, row.high, row.low, row.close, row.volume ?? 0].join(':')
    : ''
  return [
    realRows.length,
    rowSignature(first),
    rowSignature(middle),
    rowSignature(previousLast),
    rowSignature(last),
  ].join('|')
}

function getCachedPageMmfV3Rows(signature: string) {
  const cached = pageMmfV3RowsBySignature.get(signature)
  if (cached) {
    pageMmfV3RowsBySignature.delete(signature)
    pageMmfV3RowsBySignature.set(signature, cached)
  }
  return cached
}

function setCachedPageMmfV3Rows(signature: string, rows: Promise<MmfV3IndicatorRow[]> | MmfV3IndicatorRow[]) {
  pageMmfV3RowsBySignature.set(signature, rows)
  while (pageMmfV3RowsBySignature.size > 24) {
    const oldest = pageMmfV3RowsBySignature.keys().next().value
    if (oldest == null) break
    pageMmfV3RowsBySignature.delete(oldest)
  }
}

async function calculateRemoteMmfV3Rows(dataList: KLineData[], inputContext?: unknown): Promise<MmfV3IndicatorRow[]> {
  const context = normalizeMmfV3Context(inputContext)
  const realRows = stripFuturePlaceholders(dataList)
  if (context.pageKey) {
    const snapshot = readIndicatorPageSnapshot(context.pageKey)
    if (
      snapshot &&
      snapshot.symbol === context.symbol &&
      snapshot.period === context.period &&
      (snapshot.settingsHashes?.MMF_V3 ?? snapshot.settingsHash) === context.settingsHash
    ) {
      return mergeRealRowsWithPlaceholders(dataList, realRows.map((row) => {
        const barKey = assignBarKey(row, context.symbol, context.period)
        return snapshot.byBarKey[barKey]?.mmfV3 ?? {}
      }))
    }
  }
  if (context.staticRows && context.staticRows.length === realRows.length) {
    return mergeRealRowsWithPlaceholders(dataList, context.staticRows)
  }
  if (!context.symbol || realRows.length === 0) return mergeRealRowsWithPlaceholders(dataList, createEmptyMmfV3Rows(realRows.length))
  const allCalculationRows = realRows.length > 1 ? realRows.slice(0, -1) : realRows
  const settingsSignature = createRemoteMmfV3SettingsSignature(context)
  const previous = getLastRemoteMmfV3Result(settingsSignature)
  const calculationLimits = resolveRemoteMmfV3CalculationLimits(context.period)
  const canUseIncrementalTail = Boolean(
    previous &&
    previous.settingsSignature === settingsSignature &&
    previous.rowsLength > 0 &&
    allCalculationRows.length > previous.rowsLength &&
    allCalculationRows[0]?.timestamp === previous.firstTimestamp &&
    allCalculationRows[previous.rowsLength - 1]?.timestamp === previous.lastTimestamp,
  )
  const hasVisibleWindow = context.visibleFrom != null && context.visibleTo != null
  const visibleStart = hasVisibleWindow
    ? Math.max(0, Math.min(allCalculationRows.length - 1, Number(context.visibleFrom)))
    : null
  const visibleEnd = hasVisibleWindow
    ? Math.max(0, Math.min(allCalculationRows.length - 1, Number(context.visibleTo)))
    : null
  const visibleWindowStart = visibleStart != null
    ? Math.max(0, visibleStart - remoteMmfV3VisibleWarmupRows)
    : null
  const visibleWindowEnd = visibleEnd != null
    ? Math.min(allCalculationRows.length, visibleEnd + remoteMmfV3VisibleForwardRows + 1)
    : null
  const incrementalTailStart = canUseIncrementalTail
    ? Math.max(0, allCalculationRows.length - calculationLimits.incrementalRows)
    : 0
  const skippedRows = visibleWindowStart != null
    ? visibleWindowStart
    : canUseIncrementalTail && previous && previous.resultRows.length >= incrementalTailStart
    ? incrementalTailStart
    : Math.max(0, allCalculationRows.length - calculationLimits.calculationRows)
  const calculationEnd = visibleWindowEnd ?? allCalculationRows.length
  const calculationMode: 'full' | 'incremental' = !hasVisibleWindow && skippedRows === incrementalTailStart && canUseIncrementalTail ? 'incremental' : 'full'
  const calculationRows = allCalculationRows.slice(skippedRows, calculationEnd)

  const signature = createRemoteMmfV3Signature(calculationRows, context, skippedRows, calculationMode)
  const cached = getCachedRemoteMmfV3Rows(signature)
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

  const request = calculateMmfV3IndicatorMarkers({
    includeSignalFrame: false,
    rows,
    settings: {
      ma: {
        length: normalizePositiveInteger(context.maSettings.length, mmfV3InternalMaSettings.length),
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
        dSmoothing: normalizePositiveInteger(context.stochSettings.dSmoothing, mmfV3InternalStochSettings.dSmoothing),
        kSmoothing: normalizePositiveInteger(context.stochSettings.kSmoothing, mmfV3InternalStochSettings.kSmoothing),
        length: normalizePositiveInteger(context.stochSettings.length, mmfV3InternalStochSettings.length),
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
        : createEmptyMmfV3Rows(skippedRows)
      return [
        ...prefixRows,
        ...calculatedRows,
        ...createEmptyMmfV3Rows(realRows.length - skippedRows - calculatedRows.length),
      ]
    })
    .catch(() => createEmptyMmfV3Rows(realRows.length))

  setCachedRemoteMmfV3Rows(signature, request)
  const calculated = await request
  setCachedRemoteMmfV3Rows(signature, calculated)
  setLastRemoteMmfV3Result(settingsSignature, {
    firstTimestamp: allCalculationRows[0]?.timestamp,
    lastTimestamp: allCalculationRows[allCalculationRows.length - 1]?.timestamp,
    resultRows: calculated,
    rowsLength: allCalculationRows.length,
    settingsSignature,
  })
  return mergeRealRowsWithPlaceholders(dataList, calculated)
}

export function calculateMmfV3RowsForPage(dataList: KLineData[], inputContext?: unknown): Promise<MmfV3IndicatorRow[]> {
  const context = {
    ...(inputContext && typeof inputContext === 'object' ? inputContext as Record<string, unknown> : {}),
    staticRows: undefined,
    visibleFrom: undefined,
    visibleTo: undefined,
  }
  const normalizedContext = normalizeMmfV3Context(context)
  const signature = [
    'page',
    createRemoteMmfV3SettingsSignature(normalizedContext),
    createMmfV3PageDataSignature(dataList),
  ].join('|')
  const cached = getCachedPageMmfV3Rows(signature)
  if (cached) return Promise.resolve(cached)
  const request = calculateRemoteMmfV3Rows(dataList, context)
    .then((rows) => rows.filter((_, index) => !isFuturePlaceholder(dataList[index])))
  setCachedPageMmfV3Rows(signature, request)
  return request.then((rows) => {
    setCachedPageMmfV3Rows(signature, rows)
    return rows
  })
}

export function calculateMmfV3RowsForDisplayPage({
  calculationRows,
  displayRows,
  inputContext,
}: {
  calculationRows: KLineData[]
  displayRows: KLineData[]
  inputContext?: unknown
}): Promise<MmfV3IndicatorRow[]> {
  const context = {
    ...(inputContext && typeof inputContext === 'object' ? inputContext as Record<string, unknown> : {}),
    pageKey: undefined,
    staticRows: undefined,
    visibleFrom: undefined,
    visibleTo: undefined,
  }
  const displayRealRows = stripFuturePlaceholders(displayRows)
  const calculationRealRows = stripFuturePlaceholders(calculationRows)
  return calculateRemoteMmfV3Rows(calculationRealRows, context)
    .then((calculatedRows) => {
      const rowsByBarKey = new Map<string, MmfV3IndicatorRow>()
      calculationRealRows.forEach((row, index) => {
        rowsByBarKey.set(assignBarKey(row, normalizeMmfV3Context(context).symbol, normalizeMmfV3Context(context).period), calculatedRows[index] ?? {})
      })
      return displayRealRows.map((row) => {
        const barKey = assignBarKey(row, normalizeMmfV3Context(context).symbol, normalizeMmfV3Context(context).period)
        return rowsByBarKey.get(barKey) ?? {}
      })
    })
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MmfV3IndicatorRow>) {
  const crosshairIndex = Number(params.crosshair?.dataIndex)
  if (Number.isFinite(crosshairIndex)) return Math.max(0, Math.min(params.indicator.result.length - 1, Math.round(crosshairIndex)))
  return Math.max(0, params.indicator.result.length - 1)
}

function resolveMmfV3SymbolOffsetScale(symbol: string) {
  if (['\u25cf', '\u25cb', '\u25a0', '\u25a1'].includes(symbol)) return 0.78
  return 1
}

function resolveMmfV3BaseMarkerOffset(size: number, offsetMultiplier: number, symbol: string) {
  const scale = resolveMmfV3SymbolOffsetScale(symbol)
  return Math.max(4, Math.round(size * offsetMultiplier * scale))
}

function resolveMmfV3MarkerOffset(size: number, direction: -1 | 1, stackIndex: number, baseOffset: number) {
  const stackOffset = stackIndex <= 1
    ? Math.round(size * 0.9 * stackIndex)
    : Math.round(size * (0.9 + 0.68 * (stackIndex - 1)))
  return direction * (baseOffset + stackOffset)
}

function drawMmfV3Markers({
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: {
  ctx: CanvasRenderingContext2D
  indicator: { calcParams: unknown[]; result: MmfV3IndicatorRow[] }
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
  yAxis: { convertToPixel: (value: number) => number }
}) {
  const context = normalizeMmfV3Context(indicator.calcParams[0])
  const settings = context.settings
  const start = Math.max(0, Math.floor(visibleRange.from) - 2)
  const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 2)
  const visibleSpecs = mmfV3MarkerSpecs.filter((spec) => spec.show(settings))

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
      const baseOffset = resolveMmfV3BaseMarkerOffset(size, spec.offsetMultiplier, symbol)
      const offset = resolveMmfV3MarkerOffset(size, spec.yDirection, stackIndex, baseOffset)
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

function createMmfV3TooltipValues(row: MmfV3IndicatorRow | undefined, settings: MmfIndicatorSettings, textColor: string) {
  return mmfV3MarkerSpecs.flatMap((spec) => {
    const price = row?.[spec.priceKey]
    if (!spec.show(settings) || !Number.isFinite(price)) return []
    const distance = spec.distanceKey ? row?.[spec.distanceKey] : undefined
    return [{
      title: { text: spec.title, color: textColor },
      value: { text: String(price), color: spec.color(settings) },
    }, ...(Number.isFinite(distance) ? [{
      title: { text: '\u8ddd\u79bb ', color: textColor },
      value: { text: formatMmfV3PointDistance(distance), color: spec.color(settings) },
    }] : [])]
  })
}

function formatMmfV3PointDistance(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return number.toFixed(2).replace(/\.?0+$/, '')
}

export function ensureTradingViewMmfV3Indicator() {
  if (registered) return
  registered = true

  registerIndicator<MmfV3IndicatorRow>({
    name: 'MMF_V3',
    shortName: 'MMF v3',
    calcParams: [{ settings: defaultMmfIndicatorSettings }],
    series: IndicatorSeries.Price,
    createTooltipDataSource: (params) => {
      const context = normalizeMmfV3Context(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      return {
        name: 'MMF v3',
        calcParamsText: '',
        icons: [],
        values: createMmfV3TooltipValues(row, context.settings, params.defaultStyles.tooltip.text.color),
      }
    },
    draw: (params) => {
      drawMmfV3Markers(params)
      return true
    },
    calc: (dataList, indicator) => calculateRemoteMmfV3Rows(dataList, indicator.calcParams[0]),
  })
}

