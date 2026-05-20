import { LineType, registerIndicator } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import { readSettingsBooleanValue, readSettingsSymbolState } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { resolvePeriodSeconds } from './chartTimeFormatting'

const sessionBreakIndicatorName = 'FF_SESSION_BREAKS'
const sessionBreakMinVisibleLineDistancePx = 14
let sessionBreakIndicatorRegistered = false

type SettingsSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

type SessionBreakCoordinate = {
  index: number
  x: number
}

type IndicatorXAxisAdapter = {
  convertToPixel?: (value: number) => number
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
  return readSettingsBooleanValue(chartSettingKeys.sessionBreakVisible, chartSettingDefaults.sessionBreakVisible)
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

export function applySessionBreakIndicator(chart: Chart, symbol: string, period: string) {
  ensureSessionBreakIndicatorRegistered()
  chart.removeIndicator('candle_pane', sessionBreakIndicatorName)
  if (readSessionBreakVisible()) {
    chart.createIndicator({ name: sessionBreakIndicatorName, extendData: { period, symbol }, visible: true, zLevel: 0 }, true, { id: 'candle_pane' })
  }
}
