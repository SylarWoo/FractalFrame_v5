import { readJson, writeJson } from '../persistence/jsonStorage'
import type { SettingsLineSwatchValue, SettingsSwatchValue } from '../settings/SettingsSwatches'

export type DrawingRulerStatsData = 'bars-range' | 'date-time-range' | 'percent-change' | 'point-change' | 'price-range' | 'volume'

export type DrawingRulerStyle = {
  background: SettingsSwatchValue
  backgroundVisible: boolean
  borderLineStyle: SettingsLineSwatchValue
  borderVisible: boolean
  labelBackground: SettingsSwatchValue
  labelBackgroundVisible: boolean
  labelColor: SettingsSwatchValue
  labelFontSize: number
  statsAlwaysVisible: boolean
  statsData: DrawingRulerStatsData[]
}

export const drawingRulerStyleStorageKey = 'fractalframe.drawingsDrawer.rulerStyle'

function normalizeSwatchValue(value: Partial<SettingsSwatchValue> | null | undefined, fallback: SettingsSwatchValue): SettingsSwatchValue {
  const opacity = Number(value?.opacity)
  return {
    hex: typeof value?.hex === 'string' && value.hex.trim() ? value.hex.trim() : fallback.hex,
    opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(opacity, 1)) : fallback.opacity,
  }
}

function createDefaultRulerLineStyle(color = '#2962ff'): SettingsLineSwatchValue {
  return {
    hex: color,
    lineStyle: 'solid',
    opacity: 1,
    thickness: 1,
  }
}

function normalizeRulerLineStyle(lineStyle: SettingsLineSwatchValue | undefined, fallbackColor = '#2962ff'): SettingsLineSwatchValue {
  return {
    hex: typeof lineStyle?.hex === 'string' ? lineStyle.hex : fallbackColor,
    lineStyle: lineStyle?.lineStyle === 'dashed' || lineStyle?.lineStyle === 'dotted' ? lineStyle.lineStyle : 'solid',
    opacity: typeof lineStyle?.opacity === 'number' && Number.isFinite(lineStyle.opacity) ? Math.max(0, Math.min(lineStyle.opacity, 1)) : 1,
    thickness: typeof lineStyle?.thickness === 'number' && Number.isFinite(lineStyle.thickness) ? Math.max(1, Math.min(Math.round(lineStyle.thickness), 4)) : 1,
  }
}

export function createDefaultDrawingRulerStyle(): DrawingRulerStyle {
  return {
    background: { hex: '#2962ff', opacity: 0.14 },
    backgroundVisible: true,
    borderLineStyle: createDefaultRulerLineStyle('#8aa8f8'),
    borderVisible: false,
    labelBackground: { hex: '#f0f0f0', opacity: 1 },
    labelBackgroundVisible: true,
    labelColor: { hex: '#000000', opacity: 1 },
    labelFontSize: 12,
    statsAlwaysVisible: false,
    statsData: ['price-range'],
  }
}

export function normalizeDrawingRulerStyle(value: Partial<DrawingRulerStyle> | null | undefined): DrawingRulerStyle {
  const fallback = createDefaultDrawingRulerStyle()
  const allowed = new Set<DrawingRulerStatsData>(['price-range', 'percent-change', 'point-change', 'bars-range', 'date-time-range', 'volume'])
  const statsData = Array.isArray(value?.statsData)
    ? value.statsData
      .filter((item): item is DrawingRulerStatsData => typeof item === 'string' && allowed.has(item as DrawingRulerStatsData))
      .filter((item, index, array) => array.indexOf(item) === index)
    : fallback.statsData
  const fontSize = Number(value?.labelFontSize)
  return {
    background: normalizeSwatchValue(value?.background, fallback.background),
    backgroundVisible: value?.backgroundVisible !== false,
    borderLineStyle: normalizeRulerLineStyle(value?.borderLineStyle, fallback.borderLineStyle.hex),
    borderVisible: value?.borderVisible === true,
    labelBackground: normalizeSwatchValue(value?.labelBackground, fallback.labelBackground),
    labelBackgroundVisible: value?.labelBackgroundVisible !== false,
    labelColor: normalizeSwatchValue(value?.labelColor, fallback.labelColor),
    labelFontSize: Number.isFinite(fontSize) ? Math.max(8, Math.min(48, Math.round(fontSize))) : fallback.labelFontSize,
    statsAlwaysVisible: value?.statsAlwaysVisible === true,
    statsData,
  }
}

export function readDrawingRulerStyle() {
  return normalizeDrawingRulerStyle(readJson<Partial<DrawingRulerStyle> | null>(drawingRulerStyleStorageKey, null))
}

export function writeDrawingRulerStyle(value: DrawingRulerStyle) {
  return writeJson(drawingRulerStyleStorageKey, normalizeDrawingRulerStyle(value))
}
