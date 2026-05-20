import { clamp, normalizeHex6 } from './chartColorMathV1.js'
import {
  readChartColorPaletteCustomColorsV1,
  writeChartColorPaletteCustomColorsV1,
} from './chartColorPaletteStorageV1.js'

export function bindChartColorPaletteCustomPickerV1({
  sv = null,
  hue = null,
  hexInput = null,
  hexAdd = null,
  getHsv = null,
  setHsv = null,
  getHex = null,
  setHex = null,
  syncHsvFromHex = null,
  applyHsvToHex = null,
  markActiveSwatch = null,
  refreshCustomUi = null,
  renderCustomRow = null,
  emit = null,
  showCustomColorsRow = false,
} = {}) {
  if (!sv || !hue || !hexInput || !hexAdd) return { snapshot: { bound: false } }

  const readHsv = () => (typeof getHsv === 'function' ? getHsv() : { h: 0, s: 0, v: 0 })
  const writeHsv = (next) => {
    if (typeof setHsv === 'function') setHsv(next)
  }

  const pickSv = (clientX, clientY) => {
    const rect = sv.getBoundingClientRect()
    const hsv = readHsv()
    writeHsv({
      ...hsv,
      s: clamp((clientX - rect.left) / rect.width, 0, 1),
      v: clamp(1 - (clientY - rect.top) / rect.height, 0, 1),
    })
    applyHsvToHex?.()
  }

  const pickHue = (clientY) => {
    const rect = hue.getBoundingClientRect()
    const hsv = readHsv()
    writeHsv({
      ...hsv,
      h: clamp(((clientY - rect.top) / rect.height) * 360, 0, 359.99),
    })
    applyHsvToHex?.()
  }

  let svDrag = false
  let hueDrag = false
  sv.addEventListener('pointerdown', (ev) => {
    sv.setPointerCapture(ev.pointerId)
    svDrag = true
    pickSv(ev.clientX, ev.clientY)
  })
  sv.addEventListener('pointermove', (ev) => {
    if (!svDrag) return
    pickSv(ev.clientX, ev.clientY)
  })
  sv.addEventListener('pointerup', () => {
    svDrag = false
  })
  sv.addEventListener('pointercancel', () => {
    svDrag = false
  })

  hue.addEventListener('pointerdown', (ev) => {
    hue.setPointerCapture(ev.pointerId)
    hueDrag = true
    pickHue(ev.clientY)
  })
  hue.addEventListener('pointermove', (ev) => {
    if (!hueDrag) return
    pickHue(ev.clientY)
  })
  hue.addEventListener('pointerup', () => {
    hueDrag = false
  })
  hue.addEventListener('pointercancel', () => {
    hueDrag = false
  })

  hexInput.addEventListener('change', () => {
    setHex?.(normalizeHex6(hexInput.value))
    syncHsvFromHex?.()
    markActiveSwatch?.()
    refreshCustomUi?.()
    emit?.()
  })

  hexAdd.addEventListener('click', () => {
    const hex = normalizeHex6(typeof getHex === 'function' ? getHex() : hexInput.value)
    const next = [hex, ...readChartColorPaletteCustomColorsV1().filter((x) => x !== hex)]
    writeChartColorPaletteCustomColorsV1(next)
    if (showCustomColorsRow) renderCustomRow?.()
  })

  return {
    snapshot: {
      bound: true,
      hasSvPointerEvents: true,
      hasHuePointerEvents: true,
      hasHexInput: true,
      hasHexAdd: true,
    },
  }
}
