import { LineType, PolygonType } from 'klinecharts'
import type { DeepPartial, OverlayStyle } from 'klinecharts'
import { normalizeDrawingLineStyle } from '../rightDrawer/drawingPersistence'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'

export function colorWithAlpha(hex: string, opacity: number) {
  const normalized = hex.trim().replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return hex
  const value = Number.parseInt(normalized, 16)
  const alpha = Math.max(0, Math.min(Number.isFinite(opacity) ? opacity : 1, 1))
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

export function dashedValueForStyle(style: SettingsLineSwatchValue['lineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [6, 4]
  return [2, 2]
}

export function lineTypeForStyle(style: SettingsLineSwatchValue['lineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

export function normalizeLineStyle(lineStyle: SettingsLineSwatchValue | undefined): SettingsLineSwatchValue {
  return normalizeDrawingLineStyle(lineStyle, '#0f766e')
}

export function overlayStylesFromLine(lineStyle: SettingsLineSwatchValue): DeepPartial<OverlayStyle> {
  const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
  const size = Math.max(1, Math.min(Math.round(lineStyle.thickness), 4))
  return {
    line: {
      color,
      dashedValue: dashedValueForStyle(lineStyle.lineStyle),
      size,
      style: lineTypeForStyle(lineStyle.lineStyle),
    },
    point: {
      activeBorderColor: color,
      activeColor: color,
      borderColor: color,
      color,
    },
    text: {
      ...createPriceAxisLabelTextStyle(),
      backgroundColor: color,
      borderColor: 'transparent',
      borderSize: 0,
      color: '#ffffff',
      style: PolygonType.Fill,
    },
  }
}

export function trendOverlayStylesFromLine(lineStyle: SettingsLineSwatchValue): DeepPartial<OverlayStyle> {
  return {
    ...overlayStylesFromLine(lineStyle),
    point: {
      activeBorderColor: 'rgba(0,0,0,0)',
      activeBorderSize: 0,
      activeColor: 'rgba(0,0,0,0)',
      activeRadius: 10,
      borderColor: 'rgba(0,0,0,0)',
      borderSize: 0,
      color: 'rgba(0,0,0,0)',
      radius: 10,
    },
  }
}
