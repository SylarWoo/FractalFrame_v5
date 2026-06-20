import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, IndicatorDrawParams, KLineData } from 'klinecharts'
import { defaultMmadIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MmadIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'
import {
  calculateMorganRangeSegmentsForModeCached,
  findMorganRangeSegmentByDataIndex,
  getMorganRangeLevel,
  type MorganRangeMode,
} from './morganRangeModel'
import { mapPageIndicatorSnapshotToDataList } from './pageIndicatorRuntime'

export type MmadIndicatorRow = {
  breakBefore?: boolean
  denominator?: number
  morganHigh?: number
  morganLow?: number
  lowerBand1?: number
  mp?: number
  segmentIndex?: number
  segmentStartTimestamp?: number
  upperBand1?: number
  volumeSum?: number
  value?: number
  weightedMp?: number
}

type MmadCalcSettings = Partial<MmadIndicatorSettings> & {
  period?: string
  symbol?: string
}

type MmadKLineData = KLineData & {
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

let registered = false

function normalizeMmadSettings(input?: Partial<MmadIndicatorSettings>): MmadIndicatorSettings {
  return { ...defaultMmadIndicatorSettings, ...(input ?? {}) }
}

function readMmadSnapshotContext(input: unknown) {
  const context = input && typeof input === 'object' ? input as Partial<MmadIndicatorSettings> & { pageKey?: string; period?: string; runtimeOnly?: boolean; settingsHash?: string; symbol?: string } : {}
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

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
}

function canvasLineDashForStyle(style: MmadIndicatorSettings['lineStyle']) {
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
    { key: 'value', title: 'MMAD: ', type: 'line', styles },
    { key: 'upperBand1', title: 'Upper Band #1: ', type: 'line', styles },
    { key: 'lowerBand1', title: 'Lower Band #1: ', type: 'line', styles },
  ]
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MmadIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function resolveTimestampMs(row: KLineData) {
  const source = row as MmadKLineData
  const raw = typeof source.realTime === 'number'
    ? source.realTime
    : typeof source.realTimestamp === 'number'
      ? source.realTimestamp
      : typeof source.sourceTimestamp === 'number'
        ? source.sourceTimestamp
        : row.timestamp
  return raw < 1_000_000_000_000 ? raw * 1000 : raw
}

function isCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase()
  return /^(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)/.test(normalized)
    || /(^|[^A-Z])(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)([^A-Z]|$)/.test(normalized)
}

function resolveSessionAnchorHourUtc(symbol?: string) {
  return symbol && isCryptoSymbol(symbol) ? 0 : 22
}

function parseTradingDay(value: unknown) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return Date.UTC(year, month - 1, day)
}

function resolveIsoWeekAnchorKey(timestampMs: number) {
  const date = new Date(timestampMs)
  const day = Math.floor(timestampMs / 86_400_000)
  const weekday = date.getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  return `week:${day - mondayOffset}`
}

function resolveWeekAlignedMonthAnchorKey(timestampMs: number) {
  const date = new Date(timestampMs)
  let year = date.getUTCFullYear()
  let month = date.getUTCMonth()
  const firstDayWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const firstMondayDate = 1 + ((1 - firstDayWeekday + 7) % 7)

  if (date.getUTCDate() < firstMondayDate) {
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
  }

  return `month:${year}:${month}`
}

function isFirstMondayOfMonth(timestampMs: number) {
  const date = new Date(timestampMs)
  return date.getUTCDay() === 1 && date.getUTCDate() <= 7
}

function resolveCalendarAnchorTimestampMs(row: KLineData, symbol?: string) {
  const anchorHourUtc = resolveSessionAnchorHourUtc(symbol)
  const anchorOffsetHours = anchorHourUtc === 0 ? 0 : 24 - anchorHourUtc
  return resolveTimestampMs(row) + anchorOffsetHours * 60 * 60 * 1000
}

function resolveSessionCalendarAnchorKey(row: KLineData, symbol?: string) {
  const anchorHourUtc = resolveSessionAnchorHourUtc(symbol)
  const anchorOffsetHours = anchorHourUtc === 0 ? 0 : 24 - anchorHourUtc
  const anchoredTimestampMs = resolveTimestampMs(row) + anchorOffsetHours * 60 * 60 * 1000
  return `session:${Math.floor(anchoredTimestampMs / 86_400_000)}`
}

function resolveExplicitSessionAnchorKey(row: KLineData) {
  const source = row as MmadKLineData
  if (typeof source.tradingDay === 'string' && source.tradingDay.trim()) return `tradingDay:${source.tradingDay.trim()}`
  if (typeof source.sessionId === 'string' && source.sessionId.trim()) return `sessionId:${source.sessionId.trim()}`
  return null
}

function resolveMmadAnchorTimestampMs(row: KLineData) {
  const source = row as MmadKLineData
  return parseTradingDay(source.tradingDay) ?? resolveTimestampMs(row)
}

function resolveMmadMode(timeframe: MmadIndicatorSettings['timeframe']): MorganRangeMode {
  if (timeframe === '2h') return 'D5_H2'
  if (timeframe === '30m') return 'D1_M30'
  return 'H4_M5'
}

function resolveMmadAnchorPeriod(timeframe: MmadIndicatorSettings['timeframe']): 'month' | 'session' | 'week' {
  if (timeframe === '2h') return 'month'
  if (timeframe === '30m') return 'week'
  return 'session'
}

function resolveMmadAnchorKey(row: KLineData, settings: MmadIndicatorSettings, symbol?: string) {
  const source = row as MmadKLineData
  const anchorPeriod = resolveMmadAnchorPeriod(settings.timeframe)
  if (anchorPeriod === 'session') {
    if (typeof source.tradingDay === 'string' && source.tradingDay.trim()) return `tradingDay:${source.tradingDay.trim()}`
    if (typeof source.sessionId === 'string' && source.sessionId.trim()) return `sessionId:${source.sessionId.trim()}`
  }
  const timestampMs = anchorPeriod === 'session'
    ? resolveMmadAnchorTimestampMs(row)
    : resolveCalendarAnchorTimestampMs(row, symbol)
  if (anchorPeriod === 'week') return resolveIsoWeekAnchorKey(timestampMs)
  if (anchorPeriod === 'month') return resolveWeekAlignedMonthAnchorKey(timestampMs)
  void symbol
  return `session:${Math.floor(timestampMs / 86_400_000)}`
}

function isMmadAnchorStartRow(row: KLineData, settings: MmadIndicatorSettings, symbol?: string) {
  const anchorPeriod = resolveMmadAnchorPeriod(settings.timeframe)
  if (anchorPeriod === 'session') return true
  const date = new Date(resolveCalendarAnchorTimestampMs(row, symbol))
  if (anchorPeriod === 'week') return date.getUTCDay() === 1
  if (anchorPeriod === 'month') return isFirstMondayOfMonth(resolveCalendarAnchorTimestampMs(row, symbol))
  return true
}

function readVolume(row: KLineData) {
  const source = row as MmadKLineData
  const value = Number(source.volume ?? source.tick_volume ?? source.tickVolume ?? source.real_volume ?? source.realVolume ?? source.vol ?? source.Volume)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function readSymbol(dataList: KLineData[], inputSettings?: MmadCalcSettings) {
  if (typeof inputSettings?.symbol === 'string' && inputSettings.symbol.trim()) return inputSettings.symbol.trim()
  const rowSymbol = (dataList.find((row) => typeof (row as MmadKLineData).symbol === 'string') as MmadKLineData | undefined)?.symbol
  return typeof rowSymbol === 'string' ? rowSymbol.trim() : ''
}

export function calculateTradingViewMmadRows(dataList: KLineData[], inputSettings: MmadCalcSettings = defaultMmadIndicatorSettings): MmadIndicatorRow[] {
  const settings = normalizeMmadSettings(inputSettings)
  const symbol = readSymbol(dataList, inputSettings)
  const segments = calculateMorganRangeSegmentsForModeCached(dataList, resolveMmadMode(settings.timeframe), 0)
  let activeAnchorKey: string | null = null
  let currentSessionCalendarAnchorKey = ''
  let cumulativeMpVolume = 0
  let cumulativePriceVolume = 0
  let cumulativePriceSquaredVolume = 0
  let cumulativeVolume = 0
  let activeSegmentKey = ''
  let previousValue = Number.NaN

  return dataList.map((row, index) => {
    const segment = findMorganRangeSegmentByDataIndex(segments, index)
    const lower = Number(getMorganRangeLevel(segment, -0.236)?.price)
    const upper = Number(getMorganRangeLevel(segment, 0.236)?.price)
    const close = Number(row.close)
    const denominator = upper - lower
    if (!segment || !Number.isFinite(close) || !Number.isFinite(lower) || !Number.isFinite(upper) || denominator <= 0) return {}

    const anchorPeriod = resolveMmadAnchorPeriod(settings.timeframe)
    const sessionCalendarAnchorKey = anchorPeriod === 'session' ? resolveSessionCalendarAnchorKey(row, symbol) : ''
    const explicitSessionAnchorKey = anchorPeriod === 'session' ? resolveExplicitSessionAnchorKey(row) : null
    const anchorKey = anchorPeriod === 'session'
      ? explicitSessionAnchorKey == null && activeAnchorKey != null && sessionCalendarAnchorKey === currentSessionCalendarAnchorKey
        ? activeAnchorKey
        : explicitSessionAnchorKey ?? sessionCalendarAnchorKey
      : resolveMmadAnchorKey(row, settings, symbol)
    if (anchorPeriod === 'session') currentSessionCalendarAnchorKey = sessionCalendarAnchorKey
    if (activeAnchorKey == null && !isMmadAnchorStartRow(row, settings, symbol)) {
      return {}
    }
    const breakBefore = activeAnchorKey != null && anchorKey !== activeAnchorKey
    if (anchorKey !== activeAnchorKey) {
      activeAnchorKey = anchorKey
      cumulativeMpVolume = 0
      cumulativePriceVolume = 0
      cumulativePriceSquaredVolume = 0
      cumulativeVolume = 0
      activeSegmentKey = ''
      previousValue = Number.NaN
    }

    const segmentKey = `${segment.index}:${segment.startIndex}:${segment.startTimestamp}`
    if (activeSegmentKey && segmentKey !== activeSegmentKey && cumulativeVolume > 0 && Number.isFinite(previousValue)) {
      const rebasedWeightedMp = (previousValue - lower) / denominator
      cumulativeMpVolume = rebasedWeightedMp * cumulativeVolume
    }
    activeSegmentKey = segmentKey

    const mp = (close - lower) / denominator
    const volume = readVolume(row)
    cumulativeMpVolume += mp * volume
    cumulativePriceVolume += close * volume
    cumulativePriceSquaredVolume += close * close * volume
    cumulativeVolume += volume
    const weightedMp = cumulativeVolume > 0 ? cumulativeMpVolume / cumulativeVolume : mp
    const value = lower + weightedMp * denominator
    const meanPrice = cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : close
    const meanPriceSquared = cumulativeVolume > 0 ? cumulativePriceSquaredVolume / cumulativeVolume : close * close
    const variance = Math.max(0, meanPriceSquared - 2 * value * meanPrice + value * value)
    const bandDistance = Math.sqrt(variance) * settings.band1Multiplier
    previousValue = value
    return {
      breakBefore,
      denominator,
      lowerBand1: value - bandDistance,
      morganHigh: upper,
      morganLow: lower,
      mp,
      segmentIndex: segment.index,
      segmentStartTimestamp: segment.startTimestamp,
      upperBand1: value + bandDistance,
      value,
      volumeSum: cumulativeVolume,
      weightedMp,
    }
  })
}

function drawMmadLineSeries(
  params: IndicatorDrawParams<MmadIndicatorRow>,
  options: {
    color: string
    key: keyof Pick<MmadIndicatorRow, 'lowerBand1' | 'upperBand1' | 'value'>
    lineStyle: MmadIndicatorSettings['lineStyle']
    lineWidth: number
    opacity: number
    visible: boolean
  },
) {
  if (!options.visible) return
  const { ctx, indicator, visibleRange, xAxis, yAxis } = params
  const rows = indicator.result ?? []
  const from = Math.max(1, Math.floor(visibleRange.from) - 1)
  const to = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  const opacity = clampOpacity(options.opacity)
  const width = Math.max(1, Math.min(Math.round(options.lineWidth), 8))
  if (opacity <= 0 || width <= 0) return

  ctx.save()
  ctx.strokeStyle = colorWithAlpha(options.color, opacity)
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(canvasLineDashForStyle(options.lineStyle))

  let drawing = false
  for (let index = from; index <= to; index += 1) {
    const prev = rows[index - 1]
    const current = rows[index]
    const prevValue = prev?.[options.key]
    const currentValue = current?.[options.key]
    if (current?.breakBefore === true || !Number.isFinite(prevValue) || !Number.isFinite(currentValue)) {
      if (drawing) {
        ctx.stroke()
        drawing = false
      }
      continue
    }
    const fromX = xAxis.convertToPixel(index - 1)
    const toX = xAxis.convertToPixel(index)
    const fromY = yAxis.convertToPixel(prevValue as number)
    const toY = yAxis.convertToPixel(currentValue as number)
    if (!drawing) {
      ctx.beginPath()
      ctx.moveTo(fromX, fromY)
      drawing = true
    }
    ctx.lineTo(toX, toY)
  }
  if (drawing) ctx.stroke()
  ctx.restore()
}

function drawMmadBandFill(params: IndicatorDrawParams<MmadIndicatorRow>, settings: MmadIndicatorSettings) {
  if (!settings.band1Visible || !settings.band1FillVisible || clampOpacity(settings.band1FillOpacity) <= 0) return
  const { ctx, indicator, visibleRange, xAxis, yAxis } = params
  const rows = indicator.result ?? []
  const from = Math.max(0, Math.floor(visibleRange.from) - 1)
  const to = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  if (to < from) return

  const flush = (upper: Array<{ x: number; y: number }>, lower: Array<{ x: number; y: number }>) => {
    if (upper.length < 2 || lower.length < 2) return
    const path = new Path2D()
    upper.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y)
      else path.lineTo(point.x, point.y)
    })
    for (let index = lower.length - 1; index >= 0; index -= 1) {
      path.lineTo(lower[index].x, lower[index].y)
    }
    path.closePath()
    ctx.fill(path)
  }

  ctx.save()
  ctx.fillStyle = colorWithAlpha(settings.band1FillColor, settings.band1FillOpacity)
  let upperPoints: Array<{ x: number; y: number }> = []
  let lowerPoints: Array<{ x: number; y: number }> = []
  for (let index = from; index <= to; index += 1) {
    const row = rows[index]
    if (row?.breakBefore === true || !Number.isFinite(row?.upperBand1) || !Number.isFinite(row?.lowerBand1)) {
      flush(upperPoints, lowerPoints)
      upperPoints = []
      lowerPoints = []
      continue
    }
    upperPoints.push({ x: xAxis.convertToPixel(index), y: yAxis.convertToPixel(row.upperBand1 as number) })
    lowerPoints.push({ x: xAxis.convertToPixel(index), y: yAxis.convertToPixel(row.lowerBand1 as number) })
  }
  flush(upperPoints, lowerPoints)
  ctx.restore()
}

function drawMmadIndicator(params: IndicatorDrawParams<MmadIndicatorRow>) {
  const settings = normalizeMmadSettings(params.indicator.calcParams[0] as Partial<MmadIndicatorSettings>)
  drawMmadBandFill(params, settings)
  drawMmadLineSeries(params, {
    color: settings.band1UpperColor,
    key: 'upperBand1',
    lineStyle: settings.band1UpperLineStyle,
    lineWidth: settings.band1UpperLineWidth,
    opacity: settings.band1UpperOpacity,
    visible: settings.band1Visible && settings.band1UpperVisible,
  })
  drawMmadLineSeries(params, {
    color: settings.band1LowerColor,
    key: 'lowerBand1',
    lineStyle: settings.band1LowerLineStyle,
    lineWidth: settings.band1LowerLineWidth,
    opacity: settings.band1LowerOpacity,
    visible: settings.band1Visible && settings.band1LowerVisible,
  })
  drawMmadLineSeries(params, {
    color: settings.lineColor,
    key: 'value',
    lineStyle: settings.lineStyle,
    lineWidth: settings.lineWidth,
    opacity: settings.lineOpacity,
    visible: settings.lineVisible,
  })
  return true
}

export function calculateMmadRowsForKLineChart(dataList: KLineData[], inputContext: unknown): MmadIndicatorRow[] {
  const context = readMmadSnapshotContext(inputContext)
  if (context.pageKey && context.symbol && context.period) {
    const rows = mapPageIndicatorSnapshotToDataList<MmadIndicatorRow>({
      dataList,
      indicator: 'mmad',
      pageKey: context.pageKey,
      period: context.period,
      settingsHashKey: 'MMAD',
      settingsHash: context.settingsHash,
      symbol: context.symbol,
    })
    if (rows) return calculateWithoutFuturePlaceholders(dataList, () => rows)
    if (context.runtimeOnly) return calculateWithoutFuturePlaceholders(dataList, (realRows) => realRows.map(() => ({})))
  }
  return calculateWithoutFuturePlaceholders(dataList, (realRows) => calculateTradingViewMmadRows(realRows, inputContext as Partial<MmadIndicatorSettings>))
}

export function ensureTradingViewMmadIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MmadIndicatorRow>({
    name: 'MMAD',
    shortName: 'MMAD',
    series: IndicatorSeries.Price,
    calcParams: [defaultMmadIndicatorSettings],
    precision: 4,
    shouldOhlc: true,
    figures: createInvisibleScaleFigures(),
    regenerateFigures: createInvisibleScaleFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeMmadSettings(params.indicator.calcParams[0] as Partial<MmadIndicatorSettings>)
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const values = settings.statusLineValuesVisible && readIndicatorValuesVisible() && settings.lineVisible
        ? [{
          title: { text: 'MMAD ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatIndicatorValue(row?.value, settings.precision, 4), color: colorWithAlpha(settings.lineColor, settings.lineOpacity) },
        }]
        : []
      return { name: 'MMAD', calcParamsText: '', icons: [], values }
    },
    draw: drawMmadIndicator,
    calc: (dataList, indicator) => calculateMmadRowsForKLineChart(dataList, indicator.calcParams[0]),
  })
}
