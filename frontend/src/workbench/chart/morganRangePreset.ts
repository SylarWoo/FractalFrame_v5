import { readJson } from '../persistence/jsonStorage'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle } from './chartDrawingStyle'
import type { RulerExtendData } from './chartDrawingTypes'

const fibRetracementStyleStorageKey = 'fractalframe.drawingsDrawer.fibRetracementStyle'

const defaultLevels = [
  { color: '#787b86', enabled: true, opacity: 1, value: '0' },
  { color: '#f23645', enabled: true, opacity: 1, value: '0.236' },
  { color: '#ff9800', enabled: true, opacity: 1, value: '0.382' },
  { color: '#4caf50', enabled: true, opacity: 1, value: '0.5' },
  { color: '#089981', enabled: true, opacity: 1, value: '0.618' },
  { color: '#2962ff', enabled: true, opacity: 1, value: '0.786' },
  { color: '#787b86', enabled: true, opacity: 1, value: '1' },
  { color: '#90caf9', enabled: false, opacity: 1, value: '1.618' },
]

const defaultQuarterLineStyle: SettingsLineSwatchValue = {
  hex: '#787b86',
  lineStyle: 'solid',
  opacity: 1,
  thickness: 1,
}

type StoredFibStyle = {
  background?: { opacity?: number }
  backgroundEnabled?: boolean
  horizontalLineStyle?: string
  horizontalLineThickness?: number
  levels?: Array<{ color?: string; enabled?: boolean; opacity?: number; value?: string }>
  quarterLineStyles?: SettingsLineSwatchValue[]
}

export function readMorganRangeFibExtendData(): RulerExtendData {
  const stored = readJson<StoredFibStyle | null>(fibRetracementStyleStorageKey, null)
  const horizontalLineStyle = stored?.horizontalLineStyle === 'dashed' || stored?.horizontalLineStyle === 'dotted'
    ? stored.horizontalLineStyle
    : 'solid'
  const horizontalLineThickness = Number(stored?.horizontalLineThickness)
  return {
    drawing: false,
    fibBackgroundOpacity: normalizeOpacity(stored?.background?.opacity, 0.25),
    fibBackgroundVisible: stored?.backgroundEnabled !== false,
    fibHorizontalLineStyle: normalizeLineStyle({
      hex: '#787b86',
      lineStyle: horizontalLineStyle,
      opacity: 1,
      thickness: Number.isFinite(horizontalLineThickness) ? Math.max(1, Math.min(Math.round(horizontalLineThickness), 4)) : 1,
    }),
    fibLevelDisplay: 'value',
    fibLevels: normalizeLevels(stored?.levels),
    fibLevelVisible: false,
    fibPriceVisible: false,
    fibQuarterLineStyles: normalizeQuarterLineStyles(stored?.quarterLineStyles),
    fibQuarterSplitVisible: true,
    fibReverse: false,
    fibTrendLineVisible: false,
    hovered: false,
    lineStyle: normalizeLineStyle({ hex: '#787b86', lineStyle: 'solid', opacity: 1, thickness: 1 }),
    locked: true,
    manualVisible: true,
    periodVisible: true,
    pressed: false,
    rulerStyle: {
      background: { hex: '#787b86', opacity: 0 },
      backgroundVisible: false,
      borderLineStyle: { hex: '#787b86', lineStyle: 'solid', opacity: 0, thickness: 1 },
      borderVisible: false,
      labelBackground: { hex: '#787b86', opacity: 0 },
      labelBackgroundVisible: false,
      labelColor: { hex: '#787b86', opacity: 0 },
      labelFontSize: 12,
      statsAlwaysVisible: false,
      statsData: [],
    },
    selected: false,
    showPriceLabel: false,
    staticRender: true,
  }
}

function normalizeLevels(levels: StoredFibStyle['levels']) {
  const source = Array.isArray(levels) && levels.length > 0 ? levels : defaultLevels
  return defaultLevels.map((fallback, index) => {
    const level = source[index] ?? fallback
    return {
      color: typeof level.color === 'string' && level.color.trim() ? level.color : fallback.color,
      enabled: level.enabled !== false,
      opacity: normalizeOpacity(level.opacity, fallback.opacity),
      value: typeof level.value === 'string' && level.value.trim() ? level.value : fallback.value,
    }
  })
}

function normalizeQuarterLineStyles(styles: unknown): SettingsLineSwatchValue[] {
  const source = Array.isArray(styles) ? styles : []
  return [0, 1, 2].map((index) => normalizeLineStyle(source[index] ?? defaultQuarterLineStyle))
}

function normalizeOpacity(value: unknown, fallback: number) {
  const opacity = Number(value)
  return Number.isFinite(opacity) ? Math.max(0, Math.min(opacity, 1)) : fallback
}
