import { normalizeHex6 } from './chartColorMathV1.js'
import { readJson, writeJson } from '../../persistence/jsonStorage'
import { storageKeys } from '../../persistence/storageKeys'

const CUSTOM_COLORS_STORAGE_KEY = storageKeys.chartColorPaletteCustomColors
const MAX_CUSTOM_COLORS = 8

export function readChartColorPaletteCustomColorsV1() {
  try {
    const arr = readJson(CUSTOM_COLORS_STORAGE_KEY, [])
    if (!Array.isArray(arr)) return []
    return arr.map((x) => normalizeHex6(x)).filter((x) => /^#[0-9a-f]{6}$/.test(x)).slice(0, MAX_CUSTOM_COLORS)
  } catch {
    return []
  }
}

export function writeChartColorPaletteCustomColorsV1(list) {
  try {
    writeJson(CUSTOM_COLORS_STORAGE_KEY, list.slice(0, MAX_CUSTOM_COLORS))
  } catch {
    /* ignore */
  }
}
