import { normalizeHex6 } from './chartColorMathV1.js'

const CUSTOM_COLORS_STORAGE_KEY = 'ffChartColorPaletteCustomColorsV1'
const MAX_CUSTOM_COLORS = 8

export function readChartColorPaletteCustomColorsV1() {
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY)
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.map((x) => normalizeHex6(x)).filter((x) => /^#[0-9a-f]{6}$/.test(x)).slice(0, MAX_CUSTOM_COLORS)
  } catch {
    return []
  }
}

export function writeChartColorPaletteCustomColorsV1(list) {
  try {
    localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CUSTOM_COLORS)))
  } catch {
    /* ignore */
  }
}
