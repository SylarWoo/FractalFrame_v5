import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorDrawParams, KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings, defaultMmfIndicatorSettings, defaultStochIndicatorSettings, defaultTsiIndicatorSettings, defaultVdoIndicatorSettings, defaultVmiIndicatorSettings, defaultVwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MaIndicatorSettings, MmfIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, VdoIndicatorSettings, VmiIndicatorSettings, VwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMmfV3IndicatorMarkers } from '../../services/mt5/mmfV3IndicatorApi'
import type { MmfV3IndicatorMarker } from '../../services/mt5/mmfV3IndicatorApi'
import { assignBarKey, createBarIndexResolver, getKLineTimeSeconds } from './barIdentity'
import { isFuturePlaceholder, stripFuturePlaceholders } from './chartFuturePlaceholders'

export const bprM5StrategyIndicatorName = 'BPR_M5_STRATEGY'

type BprM5StrategyContext = {
  maSettings?: Partial<MaIndicatorSettings>
  mmfSettings?: Partial<MmfIndicatorSettings>
  morganRangeMode?: 'D1_M30' | 'H4_M5'
  period?: string
  stochSettings?: Partial<StochIndicatorSettings>
  symbol?: string
  tsiSettings?: Partial<TsiIndicatorSettings>
  vdoSettings?: Partial<VdoIndicatorSettings>
  vmiSettings?: Partial<VmiIndicatorSettings>
  vwapSettings?: Partial<VwapIndicatorSettings>
}

type BprM5StrategyRow = {
  marker?: number
  placement?: 'above' | 'below'
  text?: string
  color?: string
}

let registered = false
const bprM5EngineVersion = 'bpr-m5-strategy-v2-vdo-inner-entry'
const bprM5RowsBySignature = new Map<string, Promise<BprM5StrategyRow[]> | BprM5StrategyRow[]>()
const strategyMarkerTypes = new Set([
  'MMF_V3_BPR_LONG_ENTRY',
  'MMF_V3_BPR_LONG_EXIT',
  'MMF_V3_BPR_SHORT_ENTRY',
  'MMF_V3_BPR_SHORT_EXIT',
  'MMF_V3_BPR_LONG_STOP_LOSS',
  'MMF_V3_BPR_SHORT_STOP_LOSS',
])

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

function normalizeContext(input: unknown) {
  const context = input && typeof input === 'object' ? input as BprM5StrategyContext : {}
  return {
    maSettings: { ...defaultMaIndicatorSettings, ...(context.maSettings ?? {}) },
    mmfSettings: { ...defaultMmfIndicatorSettings, ...(context.mmfSettings ?? {}) },
    morganRangeMode: context.morganRangeMode === 'D1_M30' ? 'D1_M30' : 'H4_M5',
    period: normalizeStoreTimeframe(context.period),
    stochSettings: { ...defaultStochIndicatorSettings, ...(context.stochSettings ?? {}) },
    symbol: typeof context.symbol === 'string' && context.symbol.trim() ? context.symbol.trim() : '',
    tsiSettings: { ...defaultTsiIndicatorSettings, ...(context.tsiSettings ?? {}) },
    vdoSettings: { ...defaultVdoIndicatorSettings, ...(context.vdoSettings ?? {}) },
    vmiSettings: { ...defaultVmiIndicatorSettings, ...(context.vmiSettings ?? {}) },
    vwapSettings: { ...defaultVwapIndicatorSettings, ...(context.vwapSettings ?? {}) },
  }
}

function createSettingsSignature(context: ReturnType<typeof normalizeContext>) {
  return [
    bprM5EngineVersion,
    context.symbol,
    context.period,
    context.morganRangeMode,
    context.maSettings.length,
    context.maSettings.source,
    context.maSettings.type,
    context.stochSettings.length,
    context.stochSettings.kSmoothing,
    context.stochSettings.dSmoothing,
    context.tsiSettings.longLength,
    context.tsiSettings.shortLength,
    context.tsiSettings.signalLength,
    context.mmfSettings.tsiDeadCrossConfirmDistance,
    context.mmfSettings.tsiGoldenCrossConfirmDistance,
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
    context.vwapSettings.anchorPeriod,
    context.vwapSettings.source,
    context.vwapSettings.bandCalculationMode,
    context.vwapSettings.band1Multiplier,
    context.vwapSettings.offset,
  ].join('|')
}

function createRowsSignature(realRows: KLineData[], context: ReturnType<typeof normalizeContext>) {
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    createSettingsSignature(context),
    realRows.length,
    first?.timestamp,
    first?.open,
    last?.timestamp,
    last?.open,
    last?.high,
    last?.low,
    last?.close,
    last?.volume,
  ].join('|')
}

function getCachedRows(signature: string) {
  const cached = bprM5RowsBySignature.get(signature)
  if (cached) {
    bprM5RowsBySignature.delete(signature)
    bprM5RowsBySignature.set(signature, cached)
  }
  return cached
}

function setCachedRows(signature: string, rows: Promise<BprM5StrategyRow[]> | BprM5StrategyRow[]) {
  bprM5RowsBySignature.set(signature, rows)
  while (bprM5RowsBySignature.size > 24) {
    const oldest = bprM5RowsBySignature.keys().next().value
    if (oldest == null) break
    bprM5RowsBySignature.delete(oldest)
  }
}

function emptyRows(length: number): BprM5StrategyRow[] {
  return Array.from({ length }, () => ({}))
}

function mergeWithPlaceholders(dataList: KLineData[], realRows: BprM5StrategyRow[]) {
  const rows: BprM5StrategyRow[] = []
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

function markerText(marker: MmfV3IndicatorMarker) {
  if (marker.type === 'MMF_V3_BPR_LONG_ENTRY') return 'BPR Buy'
  if (marker.type === 'MMF_V3_BPR_LONG_EXIT') return 'BPR Long Exit'
  if (marker.type === 'MMF_V3_BPR_SHORT_ENTRY') return 'BPR Sell'
  if (marker.type === 'MMF_V3_BPR_SHORT_EXIT') return 'BPR Short Exit'
  return 'Stop Loss'
}

function markerPlacement(marker: MmfV3IndicatorMarker): 'above' | 'below' {
  if (marker.type === 'MMF_V3_BPR_LONG_ENTRY' || marker.type === 'MMF_V3_BPR_SHORT_EXIT' || marker.type === 'MMF_V3_BPR_LONG_STOP_LOSS') return 'below'
  return 'above'
}

function markerColor(marker: MmfV3IndicatorMarker) {
  if (marker.type === 'MMF_V3_BPR_LONG_ENTRY' || marker.type === 'MMF_V3_BPR_SHORT_EXIT') return '#16a34a'
  if (marker.type === 'MMF_V3_BPR_LONG_STOP_LOSS' || marker.type === 'MMF_V3_BPR_SHORT_STOP_LOSS') return '#b45309'
  return '#dc2626'
}

function createRowsFromMarkers(realRows: KLineData[], markers: MmfV3IndicatorMarker[]) {
  const rows = emptyRows(realRows.length)
  const resolveRowIndex = createBarIndexResolver(realRows)
  markers.forEach((marker) => {
    if (!strategyMarkerTypes.has(marker.type)) return
    const index = resolveRowIndex(marker.markerBarKey, marker.time, marker.index ?? marker.markerIndex)
    const price = Number(marker.price)
    if (!Number.isFinite(index) || index < 0 || index >= rows.length || !Number.isFinite(price)) return
    rows[index] = {
      marker: price,
      placement: markerPlacement(marker),
      text: markerText(marker),
      color: markerColor(marker),
    }
  })
  return rows
}

async function calculateBprM5Rows(dataList: KLineData[], inputContext?: unknown): Promise<BprM5StrategyRow[]> {
  const context = normalizeContext(inputContext)
  const realRows = stripFuturePlaceholders(dataList)
  if (!context.symbol || realRows.length === 0) return mergeWithPlaceholders(dataList, emptyRows(realRows.length))
  const calculationRows = realRows.length > 1 ? realRows.slice(0, -1) : realRows
  const signature = createRowsSignature(calculationRows, context)
  const cached = getCachedRows(signature)
  if (cached) return mergeWithPlaceholders(dataList, await cached)

  const rows = calculationRows.map((row, sourceIndex) => ({
    barKey: assignBarKey(row, context.symbol, context.period),
    close: Number(row.close),
    high: Number(row.high),
    low: Number(row.low),
    open: Number(row.open),
    sourceIndex,
    time: getKLineTimeSeconds(row),
    volume: Number(row.volume ?? 0),
  })).filter((row) => (
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
        length: normalizePositiveInteger(context.maSettings.length, defaultMaIndicatorSettings.length),
        source: context.maSettings.source,
        type: context.maSettings.type,
      },
      morgan: {
        anchor: context.morganRangeMode === 'D1_M30' ? 'd1' : 'h4',
        ratios: [-0.236, -0.118, 0.118, 0.236],
      },
      strategies: { bprM5: true },
      stoch: {
        dSmoothing: normalizePositiveInteger(context.stochSettings.dSmoothing, defaultStochIndicatorSettings.dSmoothing),
        kSmoothing: normalizePositiveInteger(context.stochSettings.kSmoothing, defaultStochIndicatorSettings.kSmoothing),
        length: normalizePositiveInteger(context.stochSettings.length, defaultStochIndicatorSettings.length),
      },
      showHigh: false,
      showLow: false,
      tsi: {
        longLength: normalizePositiveInteger(context.tsiSettings.longLength, defaultTsiIndicatorSettings.longLength),
        shortLength: normalizePositiveInteger(context.tsiSettings.shortLength, defaultTsiIndicatorSettings.shortLength),
        signalLength: normalizePositiveInteger(context.tsiSettings.signalLength, defaultTsiIndicatorSettings.signalLength),
      },
      tsiDeadCrossConfirmDistance: Number(context.mmfSettings.tsiDeadCrossConfirmDistance ?? defaultMmfIndicatorSettings.tsiDeadCrossConfirmDistance),
      tsiGoldenCrossConfirmDistance: Number(context.mmfSettings.tsiGoldenCrossConfirmDistance ?? defaultMmfIndicatorSettings.tsiGoldenCrossConfirmDistance),
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
      vwap: {
        anchorPeriod: context.vwapSettings.anchorPeriod,
        bandCalculationMode: context.vwapSettings.bandCalculationMode,
        band1Multiplier: Number(context.vwapSettings.band1Multiplier ?? defaultVwapIndicatorSettings.band1Multiplier),
        offset: Number(context.vwapSettings.offset ?? 0),
        source: context.vwapSettings.source,
        symbol: context.symbol,
      },
    },
    symbol: context.symbol,
    timeframe: context.period,
  })
    .then((payload) => [
      ...createRowsFromMarkers(calculationRows, payload.markers ?? []),
      ...emptyRows(realRows.length - calculationRows.length),
    ])
    .catch(() => emptyRows(realRows.length))

  setCachedRows(signature, request)
  const calculatedRows = await request
  setCachedRows(signature, calculatedRows)
  return mergeWithPlaceholders(dataList, calculatedRows)
}

function drawBprM5StrategyMarkers(params: IndicatorDrawParams<BprM5StrategyRow>) {
  const { ctx, indicator, visibleRange, xAxis, yAxis } = params
  const start = Math.max(0, Math.floor(visibleRange.from) - 2)
  const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 2)
  for (let index = start; index <= end; index += 1) {
    const row = indicator.result[index]
    if (!row?.text || !Number.isFinite(row.marker)) continue
    const x = xAxis.convertToPixel(index)
    const y = yAxis.convertToPixel(row.marker as number) + (row.placement === 'above' ? -18 : 18)
    ctx.save()
    ctx.font = "12px Arial, Tahoma, 'Segoe UI', sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = row.placement === 'above' ? 'bottom' : 'top'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(row.text, x, y)
    ctx.fillStyle = row.color ?? '#111827'
    ctx.fillText(row.text, x, y)
    ctx.restore()
  }
}

export function ensureTradingViewBprM5StrategyIndicator() {
  if (registered) return
  registered = true

  registerIndicator<BprM5StrategyRow>({
    name: bprM5StrategyIndicatorName,
    shortName: 'BPR M5',
    calcParams: [{}],
    series: IndicatorSeries.Price,
    createTooltipDataSource: () => ({ name: 'BPR M5', calcParamsText: '', icons: [], values: [] }),
    draw: (params) => {
      drawBprM5StrategyMarkers(params)
      return true
    },
    calc: (dataList, indicator) => calculateBprM5Rows(dataList, indicator.calcParams[0]),
  })
}
