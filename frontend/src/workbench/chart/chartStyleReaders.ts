import { LineType } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { readSettingsNumberStringValue, readSettingsStringValue, readSettingsSymbolState } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

export const chartNumberFontFamily = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, Arial, sans-serif'
export const chartNumberFontWeight = 400

type SettingsSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

export function readSymbolLabelVisibleParts() {
  const visibleParts = readSettingsSymbolState()['coordinates.symbolLabel.visibleParts']
  return Array.isArray(visibleParts)
    ? visibleParts.filter((value): value is string => typeof value === 'string')
    : ['value', 'line']
}

export function readAxisTextSize() {
  const raw = readSettingsStringValue('layout.axisText.size', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

export function resolveSwatchColor(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as SettingsSwatchValue
  const hex = typeof swatch.hex === 'string' ? swatch.hex : fallback
  const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity)
    ? Math.max(0, Math.min(swatch.opacity, 1))
    : 1
  if (opacity >= 0.999) return hex
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

export function readAxisTextColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisText.color'], '#5f6675')
}

export function readAxisLineColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisLine.color'], '#858b98')
}

export function readCandleBarStyle() {
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

export function resolveCandleValueColor(data: KLineData, barStyle: ReturnType<typeof readCandleBarStyle>) {
  const open = Number(data.open)
  const close = Number(data.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close === open) return barStyle.noChangeColor
  return close > open ? barStyle.upColor : barStyle.downColor
}

export function readPricePrecision() {
  const raw = readSettingsNumberStringValue(chartSettingKeys.pricePrecision, chartSettingDefaults.pricePrecision)
  if (raw === 'system') return 3
  const precision = typeof raw === 'string' ? Number(raw) : 6
  return Number.isFinite(precision) ? Math.max(0, Math.min(Math.round(precision), 7)) : 6
}

export function readHighLowTextSize() {
  const raw = readSettingsStringValue('coordinates.highLow.textSize', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

export function resolveLineStyle(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const lineStyle = swatch?.lineStyle
  if (lineStyle === 'dashed') return { dashedValue: [6, 4], style: LineType.Dashed }
  if (lineStyle === 'dotted') return { dashedValue: [1, 3], style: LineType.Dashed }
  return { dashedValue: [2, 2], style: LineType.Solid }
}

export function resolveLineThickness(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const thickness = typeof swatch?.thickness === 'number' && Number.isFinite(swatch.thickness) ? swatch.thickness : 1
  return Math.max(1, Math.min(Math.round(thickness), 4))
}

export function resolveStatusTitle(symbol: string, displayName?: string) {
  const mode = readSettingsStringValue(chartSettingKeys.statusTitleMode, chartSettingDefaults.statusTitleMode)
  const name = displayName?.trim() || symbol
  if (mode === 'symbol') return symbol
  if (mode === 'name') return name
  return `${symbol} · ${name}`
}
