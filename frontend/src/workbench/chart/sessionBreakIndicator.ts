import { LineType, registerIndicator } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import { readSettingsBooleanValue, readSettingsSymbolState } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { resolveTimeAlignedTradingProfile } from './pagePartition/timeAligned/timeAlignedTradingProfile'

const sessionBreakIndicatorName = 'FF_SESSION_BREAKS'
const sessionBreakMinVisibleLineDistancePx = 14
let sessionBreakIndicatorRegistered = false
const appliedSessionBreakSignatures = new WeakMap<Chart, string>()

type SettingsSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

type SessionBreakCoordinate = {
  index: number
  timestampSeconds: number | null
  x: number
}

type SessionBreakKLineData = KLineData & {
  sessionId?: string
  tradingDay?: string
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

function readSessionWeekBreakVisible() {
  return readSettingsBooleanValue(chartSettingKeys.sessionWeekBreakVisible, chartSettingDefaults.sessionWeekBreakVisible)
}

function readRealtimeWindowSeparatorVisible() {
  return readSettingsBooleanValue(
    chartSettingKeys.realtimeWindowSeparatorVisible,
    chartSettingDefaults.realtimeWindowSeparatorVisible,
  )
}

function shouldShowSessionBreaksForPeriod(period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  return Number.isFinite(periodSeconds) && periodSeconds > 0 && periodSeconds < 24 * 60 * 60
}

function resolveSessionAnchorMinuteUtc(symbol: string) {
  const profile = resolveTimeAlignedTradingProfile(symbol)
  return (((profile.boundaryHourShanghai - 8 + 24) % 24) * 60) + profile.boundaryMinuteShanghai
}

function resolveSessionDayKey(timestampMs: number, anchorMinuteUtc: number) {
  const timestampSeconds = Math.floor(timestampMs / 1000)
  const anchorSeconds = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(anchorMinuteUtc))) * 60
  return Math.floor((timestampSeconds - anchorSeconds) / (24 * 60 * 60))
}

function resolveSessionBoundarySeconds(timestampMs: number, anchorMinuteUtc: number) {
  const anchorSeconds = Math.max(0, Math.min(24 * 60 - 1, Math.trunc(anchorMinuteUtc))) * 60
  return resolveSessionDayKey(timestampMs, anchorMinuteUtc) * 24 * 60 * 60 + anchorSeconds
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

function normalizeTimestampSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
}

function resolveExplicitSessionBreakKey(row: KLineData) {
  const source = row as SessionBreakKLineData
  if (typeof source.tradingDay === 'string' && source.tradingDay.trim()) {
    return `tradingDay:${source.tradingDay.trim()}`
  }
  if (typeof source.sessionId === 'string' && source.sessionId.trim()) {
    return `sessionId:${source.sessionId.trim()}`
  }
  return null
}

export function isSessionBreakRow(previous: KLineData, current: KLineData, symbol: string) {
  const previousExplicitKey = resolveExplicitSessionBreakKey(previous)
  const currentExplicitKey = resolveExplicitSessionBreakKey(current)
  if (previousExplicitKey && currentExplicitKey) {
    return previousExplicitKey !== currentExplicitKey
  }

  const anchorMinuteUtc = resolveSessionAnchorMinuteUtc(symbol)
  return resolveSessionDayKey(resolveRealTimestampMs(previous), anchorMinuteUtc)
    !== resolveSessionDayKey(resolveRealTimestampMs(current), anchorMinuteUtc)
}

export function isSessionWeekBreakRow(previous: KLineData, current: KLineData, symbol: string) {
  if (!isSessionBreakRow(previous, current, symbol)) return false
  const anchorMinuteUtc = resolveSessionAnchorMinuteUtc(symbol)
  const boundarySeconds = resolveSessionBoundarySeconds(resolveRealTimestampMs(current), anchorMinuteUtc)
  const shanghaiWeekday = new Date((boundarySeconds + 8 * 60 * 60) * 1000).getUTCDay()
  return shanghaiWeekday === 1
}

function collectSessionBreakCoordinates(
  kLineDataList: KLineData[],
  from: number,
  to: number,
  xAxis: IndicatorXAxisAdapter,
  symbol: string,
  mode: 'day' | 'week',
) {
  const out: SessionBreakCoordinate[] = []
  for (let index = from; index <= to; index += 1) {
    if (index <= 0 || index >= kLineDataList.length) continue
    const previous = kLineDataList[index - 1]
    const current = kLineDataList[index]
    const matches = mode === 'week'
      ? previous && current && isSessionWeekBreakRow(previous, current, symbol)
      : previous && current && isSessionBreakRow(previous, current, symbol)
    if (!matches) continue
    const rawX = typeof xAxis.convertToPixel === 'function' ? xAxis.convertToPixel(index) : Number.NaN
    if (!Number.isFinite(rawX)) continue
    out.push({
      index,
      timestampSeconds: normalizeTimestampSeconds(resolveRealTimestampMs(current)),
      x: Math.round(rawX) + 0.5,
    })
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

export function filterSessionBreakCoordinatesForRealtimeSeparator(
  coords: SessionBreakCoordinate[],
  realtimeWindowSeparatorVisible: boolean,
  realtimeStart?: number | null,
) {
  if (!realtimeWindowSeparatorVisible || coords.length === 0) return coords
  const normalizedRealtimeStart = normalizeTimestampSeconds(realtimeStart)
  if (normalizedRealtimeStart == null) return coords
  return coords.filter((item) => item.timestampSeconds !== normalizedRealtimeStart)
}

function ensureSessionBreakIndicatorRegistered() {
  if (sessionBreakIndicatorRegistered) return
  registerIndicator({
    name: sessionBreakIndicatorName,
    shortName: 'Day-Line',
    calc: () => [],
    draw: ({ ctx, kLineDataList, indicator, visibleRange, bounding, xAxis }) => {
      const weekVisible = readSessionWeekBreakVisible()
      const dayVisible = readSessionBreakVisible()
      const mode: 'day' | 'week' | null = weekVisible ? 'week' : dayVisible ? 'day' : null
      if (!mode || kLineDataList.length < 2) return false
      const symbol = typeof indicator.extendData?.symbol === 'string' ? indicator.extendData.symbol : ''
      const period = typeof indicator.extendData?.period === 'string' ? indicator.extendData.period : ''
      const realtimeStart = typeof indicator.extendData?.realtimeStart === 'number' ? indicator.extendData.realtimeStart : null
      if (!shouldShowSessionBreaksForPeriod(period)) return false

      const state = readSettingsSymbolState()
      const swatch = state[mode === 'week' ? 'events.sessionWeekBreak.color' : 'events.sessionBreak.color']
      const color = resolveSwatchColor(swatch, '#93b7f4')
      const line = resolveLineStyle(swatch)
      const size = resolveLineThickness(swatch)
      const from = Math.max(1, Math.floor(visibleRange.from) - 2)
      const to = Math.min(kLineDataList.length - 1, Math.ceil(visibleRange.to) + 2)
      const coords = filterSessionBreakCoordinatesForRealtimeSeparator(
        filterCloseSessionBreakCoordinates(
          collectSessionBreakCoordinates(kLineDataList, from, to, xAxis, symbol, mode),
        ),
        readRealtimeWindowSeparatorVisible(),
        realtimeStart,
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

export function applySessionBreakIndicator(chart: Chart, symbol: string, period: string, options: {
  realtimeStart?: number | null
} = {}) {
  ensureSessionBreakIndicatorRegistered()
  const visible = readSessionBreakVisible()
  const weekVisible = readSessionWeekBreakVisible()
  const realtimeWindowSeparatorVisible = readRealtimeWindowSeparatorVisible()
  const normalizedRealtimeStart = normalizeTimestampSeconds(options.realtimeStart)
  const signature = `${symbol}:${period}:${visible ? 'visible' : 'hidden'}:${weekVisible ? 'week-visible' : 'week-hidden'}:${realtimeWindowSeparatorVisible ? 'realtime-separator' : 'session-break-only'}:${normalizedRealtimeStart ?? 'no-realtime-start'}`
  if (appliedSessionBreakSignatures.get(chart) === signature) return
  appliedSessionBreakSignatures.set(chart, signature)
  chart.removeIndicator('candle_pane', sessionBreakIndicatorName)
  if (visible || weekVisible) {
    chart.createIndicator({
      name: sessionBreakIndicatorName,
      extendData: { period, realtimeStart: normalizedRealtimeStart, symbol },
      visible: true,
      zLevel: 0,
    }, true, { id: 'candle_pane' })
  }
}
