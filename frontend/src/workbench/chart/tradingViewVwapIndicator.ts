import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultVwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VwapAnchorPeriod, VwapIndicatorSettings, VwapSource } from '../rightDrawer/indicatorPersistence'
import { normalizeVwapSettings as normalizePersistedVwapSettings } from '../rightDrawer/indicatorSettingsSchema'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'
import { mapPageIndicatorSnapshotToDataList } from './pageIndicatorRuntime'

export type VwapIndicatorRow = {
  barKey?: string
  lowerBand1?: number
  lowerBand2?: number
  lowerBand3?: number
  upperBand1?: number
  upperBand2?: number
  upperBand3?: number
  vwap?: number
}

type VwapCalcSettings = Partial<VwapIndicatorSettings> & {
  pageKey?: string
  period?: string
  realtimeBarKeyFrom?: string | null
  realtimeBarKeyTo?: string | null
  realtimeIndicatorPageKey?: string | null
  runtimeOnly?: boolean
  settingsHash?: string
  symbol?: string
}

type VwapKLineData = KLineData & {
  barKey?: string
  realTime?: number
  realTimestamp?: number
  realVolume?: number
  real_volume?: number
  sessionId?: string
  sourceTimestamp?: number
  tickVolume?: number
  tick_volume?: number
  tradingDay?: string
  vol?: number
  Volume?: number
}

export const vwapIndicatorAlgorithmVersion = 'vwap-tv-clean-v1'
export const tradingViewVwapIndicatorName = 'FF_TRADINGVIEW_VWAP'
let registered = false

function normalizeVwapSettings(input?: VwapCalcSettings): VwapIndicatorSettings {
  return normalizePersistedVwapSettings({ ...defaultVwapIndicatorSettings, ...(input ?? {}) })
}

function readVwapSnapshotContext(input: unknown) {
  const context = input && typeof input === 'object'
    ? input as VwapCalcSettings
    : {}
  return {
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    period: typeof context.period === 'string' ? context.period.trim().toUpperCase() : '',
    runtimeOnly: context.runtimeOnly === true,
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    symbol: typeof context.symbol === 'string' ? context.symbol.trim() : '',
  }
}

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function clampLineWidth(value: unknown, fallback = 1) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 4)) : fallback
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
}

function lineDashForStyle(style: VwapIndicatorSettings['vwapLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function createInvisibleScaleFigures() {
  const styles = () => ({
    color: 'rgba(0,0,0,0)',
    size: 1,
  })
  return [
    { key: 'vwap', title: 'VWAP: ', type: 'line', styles },
    { key: 'upperBand1', title: 'Upper Band #1: ', type: 'line', styles },
    { key: 'lowerBand1', title: 'Lower Band #1: ', type: 'line', styles },
    { key: 'upperBand2', title: 'Upper Band #2: ', type: 'line', styles },
    { key: 'lowerBand2', title: 'Lower Band #2: ', type: 'line', styles },
    { key: 'upperBand3', title: 'Upper Band #3: ', type: 'line', styles },
    { key: 'lowerBand3', title: 'Lower Band #3: ', type: 'line', styles },
  ]
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<VwapIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatVwapValue(value: number | undefined, precision: VwapIndicatorSettings['precision']) {
  return formatIndicatorValue(value, precision, 3)
}

function alignStrokePixel(value: number, lineWidth: number) {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function normalizePeriod(period?: string) {
  return period?.trim().toUpperCase() ?? ''
}

function shouldHideOnCurrentPeriod(settings: VwapIndicatorSettings, period?: string) {
  if (!settings.hideOnDailyOrAbove) return false
  return /^[1-9]?\d*[DWM]$/.test(normalizePeriod(period))
}

function isCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase()
  return /^(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)/.test(normalized)
    || /(^|[^A-Z])(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)([^A-Z]|$)/.test(normalized)
}

function resolveSessionAnchorHourUtc(symbol?: string) {
  return symbol && isCryptoSymbol(symbol) ? 0 : 22
}

function resolveTimestampMs(row: KLineData) {
  const source = row as VwapKLineData
  const raw = typeof source.realTime === 'number'
    ? source.realTime
    : typeof source.realTimestamp === 'number'
      ? source.realTimestamp
      : typeof source.sourceTimestamp === 'number'
        ? source.sourceTimestamp
        : row.timestamp
  return raw < 1_000_000_000_000 ? raw * 1000 : raw
}

function resolveCalendarAnchorKey(timestampMs: number, anchorPeriod: VwapAnchorPeriod, symbol?: string) {
  const anchorHourUtc = anchorPeriod === 'session' ? resolveSessionAnchorHourUtc(symbol) : 0
  const anchoredTimestampMs = timestampMs - anchorHourUtc * 60 * 60 * 1000
  const date = new Date(anchoredTimestampMs)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = Math.floor(anchoredTimestampMs / 86_400_000)

  if (anchorPeriod === 'week') return `week:${Math.floor((day + 4) / 7)}`
  if (anchorPeriod === 'month') return `month:${year * 12 + month}`
  if (anchorPeriod === 'quarter') return `quarter:${year * 4 + Math.floor(month / 3)}`
  if (anchorPeriod === 'year') return `year:${year}`
  if (anchorPeriod === 'decade') return `decade:${Math.floor(year / 10)}`
  if (anchorPeriod === 'century') return `century:${Math.floor(year / 100)}`
  return `session:${day}`
}

function resolveAnchorKey(row: KLineData, settings: VwapIndicatorSettings, symbol?: string) {
  const source = row as VwapKLineData
  if (settings.anchorPeriod === 'session') {
    if (typeof source.tradingDay === 'string' && source.tradingDay.trim()) return `tradingDay:${source.tradingDay.trim()}`
    if (typeof source.sessionId === 'string' && source.sessionId.trim()) return `sessionId:${source.sessionId.trim()}`
  }
  return resolveCalendarAnchorKey(resolveTimestampMs(row), settings.anchorPeriod, symbol)
}

function resolveExplicitSessionAnchorKey(row: KLineData) {
  const source = row as VwapKLineData
  if (typeof source.tradingDay === 'string' && source.tradingDay.trim()) return `tradingDay:${source.tradingDay.trim()}`
  if (typeof source.sessionId === 'string' && source.sessionId.trim()) return `sessionId:${source.sessionId.trim()}`
  return null
}

function calculateSourceValue(row: KLineData, source: VwapSource) {
  const open = Number(row.open)
  const high = Number(row.high)
  const low = Number(row.low)
  const close = Number(row.close)

  switch (source) {
    case 'open':
      return open
    case 'high':
      return high
    case 'low':
      return low
    case 'close':
      return close
    case 'hl2':
      return Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : Number.NaN
    case 'ohlc4':
      return Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
        ? (open + high + low + close) / 4
        : Number.NaN
    default:
      return Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
        ? (high + low + close) / 3
        : Number.NaN
  }
}

function readVolume(row: KLineData) {
  const source = row as VwapKLineData
  const value = Number(source.volume ?? source.tick_volume ?? source.tickVolume ?? source.real_volume ?? source.realVolume ?? source.vol ?? source.Volume)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function readBarKey(row: KLineData | undefined) {
  const value = (row as VwapKLineData | undefined)?.barKey
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function calculateBandDistance(vwap: number, variance: number, multiplier: number, mode: VwapIndicatorSettings['bandCalculationMode']) {
  if (!Number.isFinite(multiplier)) return 0
  if (mode === 'percentage') return Math.abs(vwap * multiplier / 100)
  return Math.sqrt(Math.max(0, variance)) * multiplier
}

function createBandRows(row: KLineData, vwap: number, variance: number, settings: VwapIndicatorSettings): VwapIndicatorRow {
  const band1 = calculateBandDistance(vwap, variance, settings.band1Multiplier, settings.bandCalculationMode)
  const band2 = calculateBandDistance(vwap, variance, settings.band2Multiplier, settings.bandCalculationMode)
  const band3 = calculateBandDistance(vwap, variance, settings.band3Multiplier, settings.bandCalculationMode)
  return {
    barKey: readBarKey(row),
    lowerBand1: vwap - band1,
    lowerBand2: vwap - band2,
    lowerBand3: vwap - band3,
    upperBand1: vwap + band1,
    upperBand2: vwap + band2,
    upperBand3: vwap + band3,
    vwap,
  }
}

function applyOffset(rows: VwapIndicatorRow[], dataList: KLineData[], offset: number) {
  if (offset === 0) return rows
  const shifted = dataList.map((row) => ({ barKey: readBarKey(row) }))
  rows.forEach((row, index) => {
    const targetIndex = index + offset
    if (targetIndex >= 0 && targetIndex < shifted.length) {
      shifted[targetIndex] = { ...row, barKey: readBarKey(dataList[targetIndex]) }
    }
  })
  return shifted
}

export function calculateTradingViewVwapRows(dataList: KLineData[], inputSettings?: VwapCalcSettings): VwapIndicatorRow[] {
  const settings = normalizeVwapSettings(inputSettings)
  if (shouldHideOnCurrentPeriod(settings, inputSettings?.period)) {
    return dataList.map((row) => ({ barKey: readBarKey(row) }))
  }

  const symbol = typeof inputSettings?.symbol === 'string' ? inputSettings.symbol : undefined
  const rows: VwapIndicatorRow[] = []
  let currentAnchorKey = ''
  let cumulativePriceVolume = 0
  let cumulativePriceSquaredVolume = 0
  let cumulativeVolume = 0
  let currentCalendarAnchorKey = ''

  for (const row of dataList) {
    const calendarAnchorKey = resolveCalendarAnchorKey(resolveTimestampMs(row), settings.anchorPeriod, symbol)
    const explicitAnchorKey = settings.anchorPeriod === 'session' ? resolveExplicitSessionAnchorKey(row) : null
    const anchorKey = explicitAnchorKey == null && currentAnchorKey && calendarAnchorKey === currentCalendarAnchorKey
      ? currentAnchorKey
      : explicitAnchorKey ?? resolveAnchorKey(row, settings, symbol)
    if (anchorKey !== currentAnchorKey) {
      currentAnchorKey = anchorKey
      cumulativePriceVolume = 0
      cumulativePriceSquaredVolume = 0
      cumulativeVolume = 0
    }
    currentCalendarAnchorKey = calendarAnchorKey

    const source = calculateSourceValue(row, settings.source)
    const volume = readVolume(row)
    if (Number.isFinite(source) && volume > 0) {
      cumulativePriceVolume += source * volume
      cumulativePriceSquaredVolume += source * source * volume
      cumulativeVolume += volume
    }

    if (cumulativeVolume <= 0) {
      rows.push({ barKey: readBarKey(row) })
      continue
    }

    const vwap = cumulativePriceVolume / cumulativeVolume
    const variance = cumulativePriceSquaredVolume / cumulativeVolume - vwap * vwap
    rows.push(createBandRows(row, vwap, variance, settings))
  }

  return applyOffset(rows, dataList, settings.offset)
}

export function calculateVwapRowsForKLineChart(dataList: KLineData[], inputContext: unknown): VwapIndicatorRow[] {
  const context = readVwapSnapshotContext(inputContext)
  if (context.pageKey && context.symbol && context.period) {
    const rows = mapPageIndicatorSnapshotToDataList<VwapIndicatorRow>({
      dataList,
      indicator: 'vwap',
      pageKey: context.pageKey,
      period: context.period,
      settingsHashKey: 'VWAP',
      settingsHash: context.settingsHash,
      symbol: context.symbol,
    })
    if (rows) {
      return calculateWithoutFuturePlaceholders(dataList, () => rows)
    }
    if (context.runtimeOnly) {
      return calculateWithoutFuturePlaceholders(dataList, (realRows) => realRows.map((row) => ({ barKey: readBarKey(row) })))
    }
  }
  return calculateWithoutFuturePlaceholders(
    dataList,
    (realRows) => calculateTradingViewVwapRows(realRows, inputContext as VwapCalcSettings | undefined),
  )
}

function convertIndicatorPoint(
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  index: number,
  value: number,
) {
  if (!Number.isFinite(value)) return null
  const x = xAxis.convertToPixel(index)
  const y = yAxis.convertToPixel(value)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function drawIndicatorLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: VwapIndicatorRow[],
  from: number,
  to: number,
  key: keyof VwapIndicatorRow,
  color: string,
  visible: boolean,
  lineStyle: VwapIndicatorSettings['vwapLineStyle'],
  lineWidth: number,
  opacity: number,
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
) {
  if (!visible) return
  const width = clampLineWidth(lineWidth)
  let started = false
  ctx.save()
  ctx.beginPath()
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = colorWithAlpha(color, opacity)
  ctx.setLineDash(lineDashForStyle(lineStyle))

  for (let index = from; index <= to; index += 1) {
    const value = rows[index]?.[key]
    const point = typeof value === 'number' ? convertIndicatorPoint(xAxis, yAxis, index, value) : null
    if (!point) {
      started = false
      continue
    }
    const y = alignStrokePixel(point.y, width)
    if (!started) {
      ctx.moveTo(point.x, y)
      started = true
    } else {
      ctx.lineTo(point.x, y)
    }
  }

  ctx.stroke()
  ctx.restore()
}

function drawIndicatorBandFill(
  ctx: CanvasRenderingContext2D,
  rows: VwapIndicatorRow[],
  from: number,
  to: number,
  settings: VwapIndicatorSettings,
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
) {
  if (!settings.band1Visible || !settings.band1FillVisible || clampOpacity(settings.band1FillOpacity) <= 0) return
  const path = new Path2D()
  let started = false
  for (let index = from; index <= to; index += 1) {
    const value = rows[index]?.upperBand1
    const point = typeof value === 'number' ? convertIndicatorPoint(xAxis, yAxis, index, value) : null
    if (!point) {
      started = false
      continue
    }
    if (!started) {
      path.moveTo(point.x, point.y)
      started = true
    } else {
      path.lineTo(point.x, point.y)
    }
  }
  for (let index = to; index >= from; index -= 1) {
    const value = rows[index]?.lowerBand1
    const point = typeof value === 'number' ? convertIndicatorPoint(xAxis, yAxis, index, value) : null
    if (point) path.lineTo(point.x, point.y)
  }
  path.closePath()
  ctx.save()
  ctx.fillStyle = colorWithAlpha(settings.band1FillColor, settings.band1FillOpacity)
  ctx.fill(path)
  ctx.restore()
}

function drawTradingViewVwapIndicator({
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: {
  ctx: CanvasRenderingContext2D
  indicator: { calcParams: unknown[]; result: VwapIndicatorRow[] }
  visibleRange: { from: number; to: number }
  xAxis: { convertToPixel: (value: number) => number }
  yAxis: { convertToPixel: (value: number) => number }
}) {
  const settings = normalizeVwapSettings(indicator.calcParams[0] as VwapCalcSettings)
  const rows = indicator.result
  const from = Math.max(0, Math.floor(Number(visibleRange.from)) - 1)
  const to = Math.min(rows.length - 1, Math.ceil(Number(visibleRange.to)) + 1)
  if (to < from) return

  drawIndicatorBandFill(ctx, rows, from, to, settings, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'vwap', settings.vwapColor, settings.vwapVisible, settings.vwapLineStyle, settings.vwapLineWidth, settings.vwapOpacity, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'upperBand1', settings.band1UpperColor, settings.band1Visible && settings.band1UpperVisible, settings.band1UpperLineStyle, settings.band1UpperLineWidth, settings.band1UpperOpacity, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'lowerBand1', settings.band1LowerColor, settings.band1Visible && settings.band1LowerVisible, settings.band1LowerLineStyle, settings.band1LowerLineWidth, settings.band1LowerOpacity, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'upperBand2', settings.band1UpperColor, settings.band2Visible, settings.band1UpperLineStyle, settings.band1UpperLineWidth, settings.band1UpperOpacity, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'lowerBand2', settings.band1LowerColor, settings.band2Visible, settings.band1LowerLineStyle, settings.band1LowerLineWidth, settings.band1LowerOpacity, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'upperBand3', settings.band1UpperColor, settings.band3Visible, settings.band1UpperLineStyle, settings.band1UpperLineWidth, settings.band1UpperOpacity, xAxis, yAxis)
  drawIndicatorLineSeries(ctx, rows, from, to, 'lowerBand3', settings.band1LowerColor, settings.band3Visible, settings.band1LowerLineStyle, settings.band1LowerLineWidth, settings.band1LowerOpacity, xAxis, yAxis)
}

export function ensureTradingViewVwapIndicator() {
  if (registered) return
  registered = true

  registerIndicator<VwapIndicatorRow>({
    name: tradingViewVwapIndicatorName,
    shortName: 'VWAP',
    series: IndicatorSeries.Price,
    precision: 2,
    shouldOhlc: true,
    figures: createInvisibleScaleFigures(),
    regenerateFigures: createInvisibleScaleFigures,
    createTooltipDataSource: (params: IndicatorCreateTooltipDataSourceParams<VwapIndicatorRow>) => {
      const settings = normalizeVwapSettings(params.indicator.calcParams[0] as VwapCalcSettings)
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputsInStatusLine && readIndicatorInputsVisible()
        ? ` ${settings.anchorPeriod} ${settings.source}`
        : ''
      const values = []

      if (settings.statusLineValuesVisible && readIndicatorValuesVisible() && settings.vwapVisible) {
        values.push({
          title: { text: '', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVwapValue(row?.vwap, settings.precision), color: colorWithAlpha(settings.vwapColor, settings.vwapOpacity) },
        })
      }

      return {
        name: 'VWAP',
        calcParamsText: inputsText,
        icons: [],
        values,
      }
    },
    draw: (params) => {
      drawTradingViewVwapIndicator(params)
      return true
    },
    calc: (dataList, indicator) => calculateVwapRowsForKLineChart(dataList, indicator.calcParams[0]),
  })
}
