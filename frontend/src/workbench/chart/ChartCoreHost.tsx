import { useEffect, useRef, useState } from 'react'
import { ActionType, LineType, LoadDataType, YAxisType, dispose, init, registerIndicator } from 'klinecharts'
import type { CandleTooltipCustomCallbackData, Chart, KLineData } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { repairStoreV5M1Gaps } from '../rightDrawer/mt5SymbolsApi'
import { readSettingsStringValue, readSettingsSymbolState, settingsSymbolChangedEvent } from '../settingsSymbolState'
import './ChartCoreHost.css'

const initialLoadLimit = 10_000
const maxInitialLoadLimit = 20_000
const historyPageSize = 10_000
const jumpWindowBars = 50_000
const realtimeTailRepairLookbackMinutes = 30
const realtimeTailRepairMaxGapMinutes = 30
const chartNumberFontFamily = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, Arial, sans-serif'
const chartNumberFontWeight = 400
const sessionBreakIndicatorName = 'FF_SESSION_BREAKS'
const sessionBreakMinVisibleLineDistancePx = 14
let sessionBreakIndicatorRegistered = false
type ChartCoreHostProps = {
  displayName?: string
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  onLoadStateChange?: (state: ChartLoadState) => void
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  symbol: string
  totalRows?: number | null
}

export type ChartLoadState = {
  error: boolean
  loading: boolean
  loadingMore: boolean
  period: string
  requestedRows: number
  rows: number
  symbol: string
  totalRows?: number | null
}

type Mt5RealtimeTickEventDetail = {
  ask?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  volume?: number | null
}

type SessionBreakCoordinate = {
  index: number
  x: number
}

type IndicatorXAxisAdapter = {
  convertToPixel?: (value: number) => number
}

function collectSessionBreakCoordinates(
  kLineDataList: KLineData[],
  from: number,
  to: number,
  xAxis: IndicatorXAxisAdapter,
  symbol: string,
) {
  const out: SessionBreakCoordinate[] = []
  for (let index = from; index <= to; index += 1) {
    if (index <= 0 || index >= kLineDataList.length) continue
    const previous = kLineDataList[index - 1]
    const current = kLineDataList[index]
    if (!previous || !current || !isSessionBreakRow(previous, current, symbol)) continue
    const rawX = typeof xAxis.convertToPixel === 'function' ? xAxis.convertToPixel(index) : Number.NaN
    if (!Number.isFinite(rawX)) continue
    out.push({ index, x: Math.round(rawX) + 0.5 })
  }
  out.sort((a, b) => a.x - b.x)
  return out
}

function filterCloseSessionBreakCoordinates(coords: SessionBreakCoordinate[]) {
  if (coords.length <= 1) return coords
  const out: SessionBreakCoordinate[] = []
  for (const item of coords) {
    const previous = out[out.length - 1]
    if (previous && Math.abs(item.x - previous.x) < sessionBreakMinVisibleLineDistancePx) {
      out[out.length - 1] = item
    } else {
      out.push(item)
    }
  }
  return out
}

function ensureSessionBreakIndicatorRegistered() {
  if (sessionBreakIndicatorRegistered) return
  registerIndicator({
    name: sessionBreakIndicatorName,
    calc: () => [],
    draw: ({ ctx, kLineDataList, indicator, visibleRange, bounding, xAxis }) => {
      if (!readSessionBreakVisible() || kLineDataList.length < 2) return false
      const symbol = typeof indicator.extendData?.symbol === 'string' ? indicator.extendData.symbol : ''
      const period = typeof indicator.extendData?.period === 'string' ? indicator.extendData.period : ''
      if (!shouldShowSessionBreaksForPeriod(period)) return false

      const state = readSettingsSymbolState()
      const swatch = state['events.sessionBreak.color']
      const color = resolveSwatchColor(swatch, '#93b7f4')
      const line = resolveLineStyle(swatch)
      const size = resolveLineThickness(swatch)
      const from = Math.max(1, Math.floor(visibleRange.from) - 2)
      const to = Math.min(kLineDataList.length - 1, Math.ceil(visibleRange.to) + 2)
      const coords = filterCloseSessionBreakCoordinates(
        collectSessionBreakCoordinates(kLineDataList, from, to, xAxis, symbol),
      )
      if (coords.length === 0) return false

      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = size
      ctx.setLineDash(line.style === LineType.Dashed ? line.dashedValue : [])

      for (const item of coords) {
        ctx.beginPath()
        ctx.moveTo(item.x, 0)
        ctx.lineTo(item.x, bounding.height)
        ctx.stroke()
      }

      ctx.restore()
      return true
    },
    shouldOhlc: false,
    shouldFormatBigNumber: false,
  })
  sessionBreakIndicatorRegistered = true
}

function resolveInitialLimit(limit?: number) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return initialLoadLimit
  }
  return Math.max(1, Math.min(Math.round(limit), maxInitialLoadLimit))
}

function readSymbolLabelVisibleParts() {
  const visibleParts = readSettingsSymbolState()['coordinates.symbolLabel.visibleParts']
  return Array.isArray(visibleParts)
    ? visibleParts.filter((value): value is string => typeof value === 'string')
    : ['value', 'line']
}

function resolveHasMoreOlder(options: {
  loadedRows: number
  pageSize: number
  receivedRows: number
  totalRows?: number | null
}) {
  if (options.receivedRows < options.pageSize) return false
  if (typeof options.totalRows === 'number' && Number.isFinite(options.totalRows)) {
    return options.loadedRows < options.totalRows
  }
  return true
}

function resolvePeriodSeconds(period: string) {
  const normalized = period.trim().toUpperCase()
  if (normalized === '1M' || normalized === 'M1') return 60
  if (normalized.endsWith('M') && normalized !== 'MN1') return Number(normalized.slice(0, -1)) * 60 || 60
  if (normalized.endsWith('H')) return Number(normalized.slice(0, -1)) * 60 * 60 || 60 * 60
  if (normalized === 'D1') return 24 * 60 * 60
  if (normalized === 'W1') return 7 * 24 * 60 * 60
  return 60
}

function readChartTimezone() {
  const value = readSettingsStringValue('time.timezone', 'UTC')
  return value === 'exchange' ? 'UTC' : value
}

function formatWeekday(timestamp: number, timezone: string) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, weekday: 'short' }).format(new Date(timestamp))
  } catch {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', weekday: 'short' }).format(new Date(timestamp))
  }
}

function formatDateParts(dateTimeFormat: Intl.DateTimeFormat, timestamp: number) {
  const parts: Record<string, string> = {}
  dateTimeFormat.formatToParts(new Date(timestamp)).forEach(({ type, value }) => {
    if (type === 'year') parts.YYYY = value
    if (type === 'month') parts.MM = value
    if (type === 'day') parts.DD = value
    if (type === 'hour') parts.HH = value === '24' ? '00' : value
    if (type === 'minute') parts.mm = value
    if (type === 'second') parts.ss = value
  })
  const timezone = dateTimeFormat.resolvedOptions().timeZone || readChartTimezone()
  return {
    DD: parts.DD ?? '01',
    HH: parts.HH ?? '00',
    MM: parts.MM ?? '01',
    YYYY: parts.YYYY ?? '1970',
    mm: parts.mm ?? '00',
    ss: parts.ss ?? '00',
    weekday: formatWeekday(timestamp, timezone),
  }
}

function formatChartDate(dateTimeFormat: Intl.DateTimeFormat, timestamp: number, format: string, type?: number) {
  const parts = formatDateParts(dateTimeFormat, timestamp)
  const settings = readSettingsSymbolState()
  const showWeekday = settings['coordinates.time.showWeekday'] !== false
  const dateFormat = typeof settings['coordinates.time.dateFormat'] === 'string'
    ? settings['coordinates.time.dateFormat']
    : 'ymd'
  const hourFormat = typeof settings['coordinates.time.hourFormat'] === 'string'
    ? settings['coordinates.time.hourFormat']
    : '24h'
  const hour24 = Number(parts.HH)
  const hour12 = Number.isFinite(hour24) ? ((hour24 + 11) % 12) + 1 : 12
  const suffix = Number.isFinite(hour24) && hour24 >= 12 ? 'PM' : 'AM'
  const timeText = hourFormat === '12h'
    ? `${String(hour12).padStart(2, '0')}:${parts.mm} ${suffix}`
    : `${parts.HH}:${parts.mm}`
  const dateText = dateFormat === 'dmy'
    ? `${parts.DD}/${parts.MM}/${parts.YYYY}`
    : dateFormat === 'mdy'
      ? `${parts.MM}/${parts.DD}/${parts.YYYY}`
      : `${parts.YYYY}/${parts.MM}/${parts.DD}`
  const dateWithWeekday = showWeekday ? `${parts.weekday} ${dateText}` : dateText
  const compactMonth = `${Number(parts.MM)}月`
  const compactDay = `${Number(parts.MM)}/${Number(parts.DD)}`

  if (type === 2) {
    if (format === 'HH:mm') return timeText
    if (format === 'YYYY') return parts.YYYY
    if (format === 'YYYY-MM') return compactMonth
    if (format === 'MM-DD') return compactDay
    if (format.includes('HH')) return `${compactDay} ${timeText}`
    if (format.includes('YYYY')) return `${parts.YYYY}/${Number(parts.MM)}/${Number(parts.DD)}`
    return compactDay
  }

  if (format === 'HH:mm') return timeText
  if (format === 'YYYY' || format === 'YYYY-MM' || format === 'MM-DD') return dateWithWeekday
  if (format.includes('YYYY') || format.includes('MM') || format.includes('DD')) {
    return format.includes('HH') ? `${dateWithWeekday} ${timeText}` : dateWithWeekday
  }
  return format
    .replace(/YYYY/g, parts.YYYY)
    .replace(/MM/g, parts.MM)
    .replace(/DD/g, parts.DD)
    .replace(/HH/g, parts.HH)
    .replace(/mm/g, parts.mm)
    .replace(/ss/g, parts.ss)
}

function readAxisTextSize() {
  const raw = readSettingsStringValue('layout.axisText.size', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

function readAxisTextColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisText.color'], '#5f6675')
}

function readAxisLineColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisLine.color'], '#858b98')
}

function resetYAxisAutoScale(chart: Chart) {
  const axisLineColor = readAxisLineColor()

  chart.setStyles({
    yAxis: {
      axisLine: {
        color: axisLineColor,
        show: true,
        size: 1,
      },
      size: 'auto',
      tickLine: {
        color: axisLineColor,
        length: 3,
        show: true,
        size: 1,
      },
      tickText: {
        color: readAxisTextColor(),
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size: readAxisTextSize(),
        weight: chartNumberFontWeight,
      },
      type: YAxisType.Normal,
    },
  })
}

type SettingsSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

function resolveSwatchColor(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as SettingsSwatchValue
  const hex = typeof swatch.hex === 'string' ? swatch.hex : fallback
  const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity)
    ? Math.max(0, Math.min(swatch.opacity, 1))
    : 1
  if (opacity >= 0.999) return hex
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function readCandleBarStyle() {
  const state = readSettingsSymbolState()

  const bodyUp = resolveSwatchColor(state['candle.body.up'], '#26a69a')
  const bodyDown = resolveSwatchColor(state['candle.body.down'], '#ef5350')
  const borderUp = resolveSwatchColor(state['candle.border.up'], bodyUp)
  const borderDown = resolveSwatchColor(state['candle.border.down'], bodyDown)
  const wickUp = resolveSwatchColor(state['candle.wick.up'], bodyUp)
  const wickDown = resolveSwatchColor(state['candle.wick.down'], bodyDown)

  return {
    upColor: bodyUp,
    downColor: bodyDown,
    noChangeColor: '#888888',
    upBorderColor: borderUp,
    downBorderColor: borderDown,
    noChangeBorderColor: '#888888',
    upWickColor: wickUp,
    downWickColor: wickDown,
    noChangeWickColor: '#888888',
  }
}

function resolveCandleValueColor(data: KLineData, barStyle: ReturnType<typeof readCandleBarStyle>) {
  const open = Number(data.open)
  const close = Number(data.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close === open) return barStyle.noChangeColor
  return close > open ? barStyle.upColor : barStyle.downColor
}

function readPricePrecision() {
  const state = readSettingsSymbolState()
  const raw = state['price.precision']
  if (raw === 'system') return 3
  const precision = typeof raw === 'string' ? Number(raw) : 6
  return Number.isFinite(precision) ? Math.max(0, Math.min(Math.round(precision), 7)) : 6
}

function readHighLowTextSize() {
  const raw = readSettingsStringValue('coordinates.highLow.textSize', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

function applyCandleBarStyle(chart: Chart) {
  chart.setStyles({
    candle: {
      bar: readCandleBarStyle(),
    },
  })
}

function applyPriceVolumePrecision(chart: Chart) {
  chart.setPriceVolumePrecision(readPricePrecision(), 0)
}

function applyGridStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const mode = typeof state['layout.grid.mode'] === 'string' ? state['layout.grid.mode'] : 'both'
  const verticalColor = resolveSwatchColor(state['layout.grid.vertical.color'], '#eef2f7')
  const horizontalColor = resolveSwatchColor(state['layout.grid.horizontal.color'], '#eef2f7')
  const showVertical = mode === 'both' || mode === 'vertical'
  const showHorizontal = mode === 'both' || mode === 'horizontal'

  chart.setStyles({
    grid: {
      show: showVertical || showHorizontal,
      horizontal: {
        color: horizontalColor,
        dashedValue: [2, 2],
        show: showHorizontal,
        size: 1,
        style: LineType.Solid,
      },
      vertical: {
        color: verticalColor,
        dashedValue: [2, 2],
        show: showVertical,
        size: 1,
        style: LineType.Solid,
      },
    },
  })
}

function resolveLineStyle(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const lineStyle = swatch?.lineStyle
  if (lineStyle === 'dashed') return { dashedValue: [6, 4], style: LineType.Dashed }
  if (lineStyle === 'dotted') return { dashedValue: [1, 3], style: LineType.Dashed }
  return { dashedValue: [2, 2], style: LineType.Solid }
}

function resolveLineThickness(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const thickness = typeof swatch?.thickness === 'number' && Number.isFinite(swatch.thickness) ? swatch.thickness : 1
  return Math.max(1, Math.min(Math.round(thickness), 4))
}

function readSessionBreakVisible() {
  return readSettingsSymbolState()['events.sessionBreak.visible'] === true
}

function isCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase()
  return /^(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)/.test(normalized)
    || /(^|[^A-Z])(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)([^A-Z]|$)/.test(normalized)
}

function shouldShowSessionBreaksForPeriod(period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  return Number.isFinite(periodSeconds) && periodSeconds > 0 && periodSeconds < 24 * 60 * 60
}

function resolveSessionAnchorHourUtc(symbol: string) {
  // Crypto is true 7x24 in most feeds, so its trading day can use UTC 00:00.
  // FX/metals/CFDs usually roll the trading day at New York close; for the user's MT5 UTC0 data
  // this is UTC 22:00, which is UTC+8 06:00.
  return isCryptoSymbol(symbol) ? 0 : 22
}

function resolveSessionDayKey(timestampMs: number, anchorHourUtc: number) {
  const timestampSeconds = Math.floor(timestampMs / 1000)
  const anchorSeconds = Math.max(0, Math.min(23, Math.trunc(anchorHourUtc))) * 60 * 60
  return Math.floor((timestampSeconds - anchorSeconds) / (24 * 60 * 60))
}

function resolveRealTimestampMs(data: KLineData) {
  const row = data as KLineData & {
    realTime?: number
    realTimestamp?: number
    sourceTimestamp?: number
  }
  const raw = typeof row.realTime === 'number'
    ? row.realTime
    : typeof row.realTimestamp === 'number'
      ? row.realTimestamp
      : typeof row.sourceTimestamp === 'number'
        ? row.sourceTimestamp
        : data.timestamp
  return raw < 1_000_000_000_000 ? raw * 1000 : raw
}

function isSessionBreakRow(previous: KLineData, current: KLineData, symbol: string) {
  const anchorHourUtc = resolveSessionAnchorHourUtc(symbol)
  return resolveSessionDayKey(resolveRealTimestampMs(previous), anchorHourUtc)
    !== resolveSessionDayKey(resolveRealTimestampMs(current), anchorHourUtc)
}

function applySessionBreakIndicator(chart: Chart, symbol: string, period: string) {
  ensureSessionBreakIndicatorRegistered()
  chart.removeIndicator('candle_pane', sessionBreakIndicatorName)
  if (readSessionBreakVisible()) {
    chart.createIndicator({ name: sessionBreakIndicatorName, extendData: { period, symbol }, visible: true, zLevel: 0 }, true, { id: 'candle_pane' })
  }
}

function applyCrosshairLineStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const swatch = state['layout.crosshair.color']
  const color = resolveSwatchColor(swatch, '#e91e63')
  const line = resolveLineStyle(swatch)
  const size = resolveLineThickness(swatch)

  chart.setStyles({
    crosshair: {
      horizontal: {
        line: {
          color,
          dashedValue: line.dashedValue,
          show: true,
          size,
          style: line.style,
        },
      },
      vertical: {
        line: {
          color,
          dashedValue: line.dashedValue,
          show: true,
          size,
          style: line.style,
        },
      },
    },
  })
}

function applyAxisTextStyle(chart: Chart) {
  const color = readAxisTextColor()
  const size = readAxisTextSize()

  chart.setStyles({
    xAxis: {
      tickText: {
        color,
        family: chartNumberFontFamily,
        marginEnd: 4,
        marginStart: 4,
        size,
        weight: chartNumberFontWeight,
      },
    },
    yAxis: {
      tickText: {
        color,
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size,
        weight: chartNumberFontWeight,
      },
    },
  })
}

function applyAxisLineStyle(chart: Chart) {
  const color = readAxisLineColor()

  chart.setStyles({
    xAxis: {
      axisLine: {
        color,
        show: true,
        size: 1,
      },
      tickLine: {
        color,
        length: 3,
        show: true,
        size: 1,
      },
    },
    yAxis: {
      axisLine: {
        color,
        show: true,
        size: 1,
      },
      tickLine: {
        color,
        length: 3,
        show: true,
        size: 1,
      },
    },
  })
}

function applyLastPriceLineStyle(chart: Chart) {
  const selectedParts = readSymbolLabelVisibleParts()
  const barStyle = readCandleBarStyle()
  const highLowParts = readSettingsSymbolState()['coordinates.highLow.visibleParts']
  const selectedHighLowParts = Array.isArray(highLowParts)
    ? highLowParts.filter((value): value is string => typeof value === 'string')
    : []
  const highLowTextSize = readHighLowTextSize()

  chart.setStyles({
    candle: {
      priceMark: {
        high: {
          color: '#131722',
          show: selectedHighLowParts.includes('high'),
          textFamily: chartNumberFontFamily,
          textSize: highLowTextSize,
          textWeight: String(chartNumberFontWeight),
        },
        last: {
          downColor: barStyle.downColor,
          line: {
            dashedValue: [2, 2],
            show: selectedParts.includes('line'),
            size: 1,
            style: LineType.Dashed,
          },
          noChangeColor: barStyle.noChangeColor,
          text: {
            borderRadius: 0,
            family: chartNumberFontFamily,
            show: selectedParts.includes('value'),
            paddingBottom: 2,
            paddingLeft: 6,
            paddingRight: 7,
            paddingTop: 4,
            weight: chartNumberFontWeight,
          },
          upColor: barStyle.upColor,
        },
        low: {
          color: '#131722',
          show: selectedHighLowParts.includes('low'),
          textFamily: chartNumberFontFamily,
          textSize: highLowTextSize,
          textWeight: String(chartNumberFontWeight),
        },
      },
    },
  })
}

function mergeKLineData(...sets: KLineData[][]): KLineData[] {
  const rowsByTimestamp = new Map<number, KLineData>()
  sets.forEach((rows) => {
    rows.forEach((row) => {
      const timestamp = Number(row.timestamp)
      if (!Number.isFinite(timestamp)) return
      rowsByTimestamp.set(timestamp, { ...row, timestamp })
    })
  })
  return [...rowsByTimestamp.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}

function resolveStatusTitle(symbol: string, displayName?: string) {
  const mode = readSettingsStringValue('status.title.mode', 'symbol-name')
  const name = displayName?.trim() || symbol
  if (mode === 'symbol') return symbol
  if (mode === 'name') return name
  return `${symbol} · ${name}`
}

function applyCandleTooltipStyle(chart: Chart, symbol: string, period: string, displayName?: string) {
  const settings = readSettingsSymbolState()
  const chartValuesVisible = settings['status.chartValues.visible'] !== false
  const candleChangeVisible = settings['status.candleChange.visible'] !== false
  const candleTimeVisible = settings['status.candleTime.visible'] !== false
  const barStyle = readCandleBarStyle()

  chart.setStyles({
    candle: {
      bar: barStyle,
      tooltip: {
        custom: ({ current }: CandleTooltipCustomCallbackData) => {
          const priceColor = resolveCandleValueColor(current, barStyle)
          return [
            {
              title: `${resolveStatusTitle(symbol, displayName)} ${period}${chartValuesVisible ? '  O: ' : ''}`,
              value: chartValuesVisible ? { text: '{open}', color: priceColor } : '',
            },
            ...(chartValuesVisible
              ? [
                  { title: 'H: ', value: { text: '{high}', color: priceColor } },
                  { title: 'L: ', value: { text: '{low}', color: priceColor } },
                  { title: 'C: ', value: { text: '{close}', color: priceColor } },
                ]
              : []),
            ...(candleChangeVisible ? [{ title: 'Chg: ', value: '{change}' }] : []),
            { title: 'Volume: ', value: '{volume}' },
            ...(candleTimeVisible ? [{ title: 'Time: ', value: '{time}' }] : []),
          ]
        },
      },
    },
  })
}

export function ChartCoreHost({ displayName, jump, limit, onLoadStateChange, period, reloadId, stepLoad, symbol, totalRows }: ChartCoreHostProps) {
  const chartInstanceRef = useRef<Chart | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const requestSeqRef = useRef(0)
  const realtimeTailRefreshInFlightRef = useRef(false)
  const realtimeTailRefreshBucketRef = useRef<number | null>(null)
  const [loadState, setLoadState] = useState({
    error: false,
    loadingMore: false,
    loading: false,
    requestedRows: resolveInitialLimit(limit),
    rows: 0,
  })

  useEffect(() => {
    onLoadStateChange?.({
      ...loadState,
      period,
      symbol,
      totalRows,
    })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useEffect(() => {
    if (!chartRef.current) return

    const container = chartRef.current
    const chart = init(container, {
      customApi: {
        formatDate: formatChartDate,
      },
      timezone: readChartTimezone(),
      styles: {
        grid: {
          horizontal: {
            color: '#eef2f7',
            dashedValue: [2, 2],
            show: true,
            size: 1,
            style: LineType.Solid,
          },
          vertical: {
            color: '#eef2f7',
            dashedValue: [2, 2],
            show: true,
            size: 1,
            style: LineType.Solid,
          },
        },
        crosshair: {
          horizontal: {
            text: {
              backgroundColor: '#131722',
              borderColor: '#131722',
              borderRadius: 0,
              color: '#ffffff',
              family: chartNumberFontFamily,
              paddingBottom: 2,
              paddingLeft: 6,
              paddingRight: 7,
              paddingTop: 4,
              weight: chartNumberFontWeight,
            },
          },
          vertical: {
            text: {
              backgroundColor: '#131722',
              borderColor: '#131722',
              borderRadius: 0,
              color: '#ffffff',
              family: chartNumberFontFamily,
              paddingBottom: 3,
              paddingLeft: 9,
              paddingRight: 9,
              paddingTop: 8,
              weight: chartNumberFontWeight,
            },
          },
        },
        xAxis: {
          axisLine: {
            color: readAxisLineColor(),
            show: true,
            size: 1,
          },
          size: 27,
          tickLine: {
            color: readAxisLineColor(),
            length: 3,
            show: true,
            size: 1,
          },
          tickText: {
            color: readAxisTextColor(),
            family: chartNumberFontFamily,
            marginEnd: 4,
            marginStart: 4,
            size: readAxisTextSize(),
            weight: chartNumberFontWeight,
          },
        },
        yAxis: {
          axisLine: {
            color: readAxisLineColor(),
            show: true,
            size: 1,
          },
          size: 'auto',
          tickLine: {
            color: readAxisLineColor(),
            length: 3,
            show: true,
            size: 1,
          },
          tickText: {
            color: readAxisTextColor(),
            family: chartNumberFontFamily,
            marginEnd: 10,
            marginStart: 7,
            size: readAxisTextSize(),
            weight: chartNumberFontWeight,
          },
        },
      },
    })

    if (chart) {
      applyPriceVolumePrecision(chart)
      applyGridStyle(chart)
      applyCrosshairLineStyle(chart)
      applyAxisTextStyle(chart)
      applyAxisLineStyle(chart)
      applyCandleBarStyle(chart)
      applyLastPriceLineStyle(chart)
      applySessionBreakIndicator(chart, symbol, period)
    }
    chartInstanceRef.current = chart ?? null

    const resize = () => {
      chart?.resize()
    }

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(resize)
    })

    resizeObserver.observe(container)
    window.addEventListener('resize', resize)
    window.requestAnimationFrame(() => {
      resize()
    })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
      chartInstanceRef.current = null

      if (chart) {
        dispose(chart)
      }
    }
  }, [])

  useEffect(() => {
    const apply = () => {
      const chart = chartInstanceRef.current
        if (chart) {
          chart.setTimezone(readChartTimezone())
          chart.setCustomApi({ formatDate: formatChartDate })
          applyPriceVolumePrecision(chart)
          applyGridStyle(chart)
          applyCrosshairLineStyle(chart)
          applyAxisTextStyle(chart)
          applyAxisLineStyle(chart)
          applyCandleTooltipStyle(chart, symbol, period, displayName)
          applyLastPriceLineStyle(chart)
          applySessionBreakIndicator(chart, symbol, period)
        }
      }
    apply()
    window.addEventListener(settingsSymbolChangedEvent, apply)
    window.addEventListener('storage', apply)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, apply)
      window.removeEventListener('storage', apply)
    }
  }, [displayName, period, symbol])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    applyCandleTooltipStyle(chart, symbol, period, displayName)
  }, [displayName, period, symbol])

  useEffect(() => {
    let disposed = false
    const chart = chartInstanceRef.current
    const requestSeq = requestSeqRef.current + 1
    const requestedRows = resolveInitialLimit(limit)
    let fallbackTimer: number | undefined
    requestSeqRef.current = requestSeq

    if (!chart) return

    const finishLoaded = () => {
      if (disposed || requestSeqRef.current !== requestSeq) return

        setLoadState({
          error: false,
          loadingMore: false,
          loading: false,
          requestedRows,
          rows: chart.getDataList().length,
        })
      }

    chart.unsubscribeAction(ActionType.OnDataReady)
    chart.subscribeAction(ActionType.OnDataReady, finishLoaded)

    setLoadState({
      error: false,
      loadingMore: false,
      loading: true,
      requestedRows,
      rows: 0,
    })

    chart.setLoadDataCallback(({ type, data, callback }) => {
      if (disposed || requestSeqRef.current !== requestSeq) {
        callback([], false)
        return
      }

      if (type !== LoadDataType.Forward || !data) {
        callback([], false)
        return
      }

      setLoadState((current) => ({
        ...current,
        error: false,
        loadingMore: true,
      }))

      const timeTo = Math.floor(data.timestamp / 1000) - 1
      console.info('[StoreV5Datafeed] request older start', {
        symbol,
        period,
        limit: historyPageSize,
        timeTo,
      })

      loadStoreV5KLineData({ symbol, period, limit: historyPageSize, timeTo })
        .then((olderData) => {
          if (disposed || requestSeqRef.current !== requestSeq) {
            callback([], false)
            return
          }

          const loadedRows = chart.getDataList().length + olderData.length
          const hasMoreOlder = resolveHasMoreOlder({
            loadedRows,
            pageSize: historyPageSize,
            receivedRows: olderData.length,
            totalRows,
          })

          console.info('[StoreV5Datafeed] callback older done', {
            rows: olderData.length,
            hasMoreOlder,
          })
          callback(olderData, hasMoreOlder)

          window.setTimeout(() => {
            if (disposed || requestSeqRef.current !== requestSeq) return
            applySessionBreakIndicator(chart, symbol, period)
            setLoadState({
              error: false,
              loading: false,
              loadingMore: false,
              requestedRows,
              rows: chart.getDataList().length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (disposed || requestSeqRef.current !== requestSeq) {
            callback([], false)
            return
          }

          console.error('[StoreV5Datafeed] request older failed', error)
          callback([], false)
          setLoadState((current) => ({
            ...current,
            error: true,
            loading: false,
            loadingMore: false,
            rows: chart.getDataList().length,
          }))
        })
    })

    if (jump?.timestamp != null) {
      const periodSeconds = resolvePeriodSeconds(period)
      const halfWindowSeconds = Math.floor(jumpWindowBars / 2) * periodSeconds
      const targetSeconds = Math.floor(jump.timestamp / 1000)
      const timeFrom = targetSeconds - halfWindowSeconds
      const timeTo = targetSeconds + halfWindowSeconds

      console.info('[StoreV5Datafeed] request jump start', {
        symbol,
        period,
        limit: jumpWindowBars,
        timeFrom,
        timeTo,
      })

      loadStoreV5KLineData({ symbol, period, limit: jumpWindowBars, timeFrom, timeTo })
        .then((data) => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          const hasMoreOlder = data.length >= jumpWindowBars
          console.info('[StoreV5Datafeed] callback jump done', {
            rows: data.length,
            target: jump.timestamp,
            hasMoreOlder,
          })
          chart.applyNewData(data, hasMoreOlder)
          fallbackTimer = window.setTimeout(() => {
            if (disposed || requestSeqRef.current !== requestSeq) return
            resetYAxisAutoScale(chart)
            chart.scrollToTimestamp(jump.timestamp as number, 0)
            applySessionBreakIndicator(chart, symbol, period)
            window.setTimeout(() => {
              if (disposed || requestSeqRef.current !== requestSeq) return
              resetYAxisAutoScale(chart)
              applySessionBreakIndicator(chart, symbol, period)
            }, 0)
            setLoadState({
              error: false,
              loadingMore: false,
              loading: false,
              requestedRows: jumpWindowBars,
              rows: chart.getDataList().length || data.length,
            })
          }, 0)
        })
        .catch((error: unknown) => {
          if (disposed || requestSeqRef.current !== requestSeq) return

          console.error('[StoreV5Datafeed] request jump failed', error)
          chart.applyNewData([], false)
          setLoadState({
            error: true,
            loadingMore: false,
            loading: false,
            requestedRows: jumpWindowBars,
            rows: 0,
          })
        })

      return () => {
        disposed = true
        chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
        chart.setLoadDataCallback(({ callback }) => callback([], false))
        if (fallbackTimer !== undefined) {
          window.clearTimeout(fallbackTimer)
        }
      }
    }

    console.info('[StoreV5Datafeed] request init start', {
      symbol,
      period,
      limit: requestedRows,
    })

    loadStoreV5KLineData({ symbol, period, limit: requestedRows })
      .then((data) => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: data.length,
          pageSize: requestedRows,
          receivedRows: data.length,
          totalRows,
        })
        console.info('[StoreV5Datafeed] callback init done', {
          rows: data.length,
          hasMoreOlder,
        })
        chart.applyNewData(data, hasMoreOlder)
        fallbackTimer = window.setTimeout(() => {
          if (disposed || requestSeqRef.current !== requestSeq) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)

          setLoadState({
            error: false,
            loadingMore: false,
            loading: false,
            requestedRows,
            rows: chart.getDataList().length || data.length,
          })
        }, 0)
      })
      .catch(() => {
        if (disposed || requestSeqRef.current !== requestSeq) return

        chart.applyNewData([], false)
        setLoadState({
          error: true,
          loadingMore: false,
          loading: false,
          requestedRows,
          rows: 0,
        })
      })

    return () => {
      disposed = true
      chart.unsubscribeAction(ActionType.OnDataReady, finishLoaded)
      chart.setLoadDataCallback(({ callback }) => callback([], false))
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer)
      }
    }
  }, [jump?.id, jump?.timestamp, limit, period, reloadId, symbol, totalRows])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    realtimeTailRefreshInFlightRef.current = false
    realtimeTailRefreshBucketRef.current = null

    const refreshRealtimeTail = async (bucketTimestamp: number) => {
      if (period.trim().toUpperCase() !== '1M' && period.trim().toUpperCase() !== 'M1') return
      if (realtimeTailRefreshInFlightRef.current) return

      realtimeTailRefreshInFlightRef.current = true
      try {
        await repairStoreV5M1Gaps(symbol, {
          lookbackMinutes: realtimeTailRepairLookbackMinutes,
          maxGapMinutes: realtimeTailRepairMaxGapMinutes,
        })

        const timeTo = Math.floor(bucketTimestamp / 1000) + 60
        const timeFrom = timeTo - realtimeTailRepairLookbackMinutes * 60
        const tailData = await loadStoreV5KLineData({
          symbol,
          period,
          limit: realtimeTailRepairLookbackMinutes + 5,
          timeFrom,
          timeTo,
        })
        if (!tailData.length) return

        const currentData = chart.getDataList()
        const merged = mergeKLineData(currentData, tailData)
        const hasMoreOlder = typeof totalRows === 'number' && Number.isFinite(totalRows)
          ? merged.length < totalRows
          : currentData.length >= historyPageSize
        chart.applyNewData(merged, hasMoreOlder)
      } catch (error) {
        console.warn('[StoreV5Datafeed] realtime tail refresh failed', error)
      } finally {
        realtimeTailRefreshInFlightRef.current = false
      }
    }

    const handleRealtimeTick = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as Partial<Mt5RealtimeTickEventDetail> : null
      if (!detail || detail.symbol !== symbol) return

      const last = typeof detail.last === 'number' && Number.isFinite(detail.last)
        ? detail.last
        : typeof detail.bid === 'number' && typeof detail.ask === 'number'
          ? (detail.bid + detail.ask) / 2
          : detail.bid ?? detail.ask
      if (typeof last !== 'number' || !Number.isFinite(last)) return

      const tickSeconds = typeof detail.time === 'number' && Number.isFinite(detail.time)
        ? Math.floor(detail.time)
        : Math.floor(Date.now() / 1000)
      const periodSeconds = resolvePeriodSeconds(period)
      const bucketTimestamp = Math.floor(tickSeconds / periodSeconds) * periodSeconds * 1000
      const currentData = chart.getDataList()
      const latest = currentData[currentData.length - 1]
      const volume = typeof detail.volume === 'number' && Number.isFinite(detail.volume) ? detail.volume : 0

      if (!latest || bucketTimestamp > latest.timestamp) {
        if (realtimeTailRefreshBucketRef.current !== bucketTimestamp) {
          realtimeTailRefreshBucketRef.current = bucketTimestamp
          void refreshRealtimeTail(bucketTimestamp)
        }
          chart.updateData({
            timestamp: bucketTimestamp,
            open: latest?.close ?? last,
            high: last,
            low: last,
            close: last,
            volume,
          })
          return
        }

        if (bucketTimestamp === latest.timestamp) {
          chart.updateData({
          ...latest,
          high: Math.max(Number(latest.high), last),
          low: Math.min(Number(latest.low), last),
            close: last,
            volume: Math.max(Number(latest.volume ?? 0), volume),
          })
        }
      }

    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    return () => window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
  }, [period, symbol, totalRows])

  useEffect(() => {
    if (!stepLoad) return

    const chart = chartInstanceRef.current
    if (!chart) return

    let disposed = false
    const currentData = chart.getDataList()
    if (!currentData.length) return

    setLoadState((current) => ({
      ...current,
      error: false,
      loadingMore: true,
    }))

    const oldest = currentData[0]
    const newest = currentData[currentData.length - 1]
    const options = stepLoad.direction === 'left'
      ? {
          limit: historyPageSize,
          period,
          symbol,
          timeTo: Math.floor(oldest.timestamp / 1000) - 1,
        }
      : {
          limit: historyPageSize,
          period,
          symbol,
          timeFrom: Math.floor(newest.timestamp / 1000) + 1,
        }

    console.info('[StoreV5Datafeed] request manual step start', {
      direction: stepLoad.direction,
      ...options,
    })

    loadStoreV5KLineData(options)
      .then((data) => {
        if (disposed) return

        const merged = stepLoad.direction === 'left'
          ? mergeKLineData(data, chart.getDataList())
          : mergeKLineData(chart.getDataList(), data)
        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: merged.length,
          pageSize: historyPageSize,
          receivedRows: stepLoad.direction === 'left' ? data.length : historyPageSize,
          totalRows,
        })

        console.info('[StoreV5Datafeed] callback manual step done', {
          direction: stepLoad.direction,
          rows: data.length,
          mergedRows: merged.length,
        })
        const targetTimestamp = stepLoad.direction === 'left'
          ? data[Math.floor(data.length / 2)]?.timestamp
          : data[Math.max(0, data.length - Math.floor(data.length / 2) - 1)]?.timestamp
        chart.applyNewData(merged, hasMoreOlder)
        window.setTimeout(() => {
          if (disposed) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)
          if (typeof targetTimestamp === 'number') {
            chart.scrollToTimestamp(targetTimestamp, 0)
          }
          setLoadState((current) => ({
            ...current,
            error: false,
            loading: false,
            loadingMore: false,
            requestedRows: current.requestedRows,
            rows: chart.getDataList().length || merged.length,
          }))
        }, 0)
      })
      .catch((error: unknown) => {
        if (disposed) return

        console.error('[StoreV5Datafeed] request manual step failed', error)
        setLoadState((current) => ({
          ...current,
          error: true,
          loading: false,
          loadingMore: false,
          rows: chart.getDataList().length,
        }))
      })

    return () => {
      disposed = true
    }
  }, [period, stepLoad, symbol, totalRows])

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}

