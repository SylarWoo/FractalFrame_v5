/**
 * TradingView-style line color popover: preset grid, custom colors, opacity,
 * thickness (1鈥揘), line style (maps to lightweight-charts LineStyle),
 * optional 鈥滆嚜閫夆€?tab with hex + SV + hue.
 *
 * TradingView 涓嶅崟鐙彁渚涜 UI锛汱ightweight Charts 浠呮湁鍥捐〃 API锛堝惈 LineStyle 鏋氫妇锛夈€?
 * 鍙€?NPM锛欯simonwep/pickr銆乿anilla-colorful銆乺eact-color 绛夈€?
 */


import {
  applySwatchLineBarPreviewV1,
  blendHexOnWhite,
  buildPresetGrid,
  clamp,
  clearOpacityPreviewLayers,
  hexToRgb,
  hsvToRgbHex,
  lineStyleLwToUi,
  lineStyleUiToLw,
  normalizeHex6,
  rgbToHsv,
  setOpacityPreviewWithCheckerboard,
} from './chartColorMathV1.js'
import {
  readChartColorPaletteCustomColorsV1,
  writeChartColorPaletteCustomColorsV1,
} from './chartColorPaletteStorageV1.js'
import {
  positionChartColorPalettePopoverV1,
  setChartColorPaletteSvPlaneBackgroundV1,
} from './chartColorPalettePositionV1.js'
import {
  createChartColorPaletteCustomAddButtonV1,
  createChartColorPaletteCustomPickerDomV1,
  createChartColorPaletteCustomRowV1,
  createChartColorPaletteGridV1,
  createChartColorPaletteOpacityControlsV1,
  createChartColorPalettePopoverShellV1,
  createChartColorPaletteSegmentButtonV1,
  createChartColorPaletteSegmentV1,
  createChartColorPaletteSettingRowV1,
  createChartColorPaletteSwatchButtonV1,
} from './chartColorPalettePopoverDomV1.js'
import { ensureChartColorPaletteStyles } from './chartColorPaletteStylesV1.js'
import { createChartColorSwatchHostCoreV1 } from './chartColorSwatchHostV1.js'
import { bindChartColorPaletteCustomPickerV1 } from './chartColorPaletteCustomPickerV1.js'
import { bindChartColorPalettePopoverEventsV1 } from './chartColorPalettePopoverEventsV1.js'
import {
  closeChartColorPalettePopoverV1,
  getChartColorPalettePopoverStateV1,
} from './chartColorPalettePopoverStateV1.js'
import { markChartColorPaletteAnchorOpenV1 } from './chartColorPalettePopoverLifecycleV1.js'

export { applySwatchLineBarPreviewV1, ensureChartColorPaletteStyles, lineStyleLwToUi, normalizeHex6 }

/**
 * @param {object} opts
 * @param {Document} opts.doc
 * @param {HTMLElement} opts.anchorEl
 * @param {string} [opts.initialHex]
 * @param {number} [opts.initialOpacity] 0鈥?
 * @param {boolean} [opts.showOpacity]
 * @param {boolean} [opts.showThickness]
 * @param {number} [opts.thicknessSteps] default 4 (RSI 涓荤嚎鍙紶 6)
 * @param {number} [opts.initialThickness]
 * @param {boolean} [opts.showLineStyle]
 * @param {'solid'|'dashed'|'dotted'} [opts.initialLineStyle]
 * @param {boolean} [opts.showPresetGrid]
 * @param {boolean} [opts.showCustomColorsRow]
 * @param {boolean} [opts.showCustomPicker] 鑹叉澘 | 鑷€夛紙hex + SV + 鑹茬浉锛?
 * @param {(p: { hex: string, opacity: number, hexOpaque: string, thickness?: number, lineStyle?: string, lineStyleLw?: number }) => void} opts.onPick
 */
export function openChartColorPalettePopoverV1(opts = {}) {
  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : null)
  if (!doc || !opts.anchorEl || typeof opts.onPick !== 'function') return { close() {} }

  ensureChartColorPaletteStyles(doc)
  closeChartColorPalettePopoverV1(doc)

  let hex = normalizeHex6(opts.initialHex)
  let opacity = clamp(Number(opts.initialOpacity ?? 1), 0, 1)
  const thicknessSteps = clamp(Math.round(Number(opts.thicknessSteps ?? 4)), 1, 8)
  let thickness = clamp(Math.round(Number(opts.initialThickness ?? 2)), 1, thicknessSteps)
  let lineStyle = ['solid', 'dashed', 'dotted'].includes(opts.initialLineStyle) ? opts.initialLineStyle : 'solid'

  const showOpacity = opts.showOpacity !== false
  const showThickness = opts.showThickness === true
  const showLineStyle = opts.showLineStyle === true
  const showPresetGrid = opts.showPresetGrid !== false
  const showCustomColorsRow = opts.showCustomColorsRow === true
  const showCustomPicker = opts.showCustomPicker === true

  const { root, column, presetsStack, tabBar, tabPreset, tabCustom, customPane } =
    createChartColorPalettePopoverShellV1(doc)

  const rgb0 = hexToRgb(hex)
  let hsv = { ...rgbToHsv(rgb0.r, rgb0.g, rgb0.b) }

  const syncHsvFromHex = () => {
    const { r, g, b } = hexToRgb(hex)
    hsv = rgbToHsv(r, g, b)
  }

  const grid = createChartColorPaletteGridV1(doc)
  const rows = buildPresetGrid()
  const swatches = []
  rows.forEach((row) => {
    row.forEach((cellHex) => {
      const b = createChartColorPaletteSwatchButtonV1(doc, cellHex)
      b.addEventListener('click', () => {
        hex = normalizeHex6(cellHex)
        syncHsvFromHex()
        swatches.forEach((s) => s.setAttribute('data-active', s === b ? 'true' : 'false'))
        refreshCustomUi()
        emit()
      })
      swatches.push(b)
      grid.appendChild(b)
    })
  })

  function markActiveSwatch() {
    swatches.forEach((s) => {
      const c = s.title
      s.setAttribute('data-active', normalizeHex6(c) === hex ? 'true' : 'false')
    })
  }
  markActiveSwatch()

  const customRow = createChartColorPaletteCustomRowV1(doc)

  const markActiveCustomRow = () => {
    if (!showCustomColorsRow) return
    ;[...customRow.children].forEach((el) => {
      if (!el.classList?.contains('ff-chart-color-palette-popover-v1__sw')) return
      el.setAttribute('data-active', normalizeHex6(el.title) === normalizeHex6(hex) ? 'true' : 'false')
    })
  }

  const renderCustomRow = () => {
    customRow.replaceChildren()
    const list = readChartColorPaletteCustomColorsV1()
    list.forEach((ch) => {
      const b = createChartColorPaletteSwatchButtonV1(doc, ch)
      b.addEventListener('click', () => {
        hex = ch
        syncHsvFromHex()
        markActiveSwatch()
        refreshCustomUi()
        emit()
      })
      customRow.appendChild(b)
    })
    const addBtn = createChartColorPaletteCustomAddButtonV1(doc)
    addBtn.addEventListener('click', () => {
      const next = [normalizeHex6(hex), ...readChartColorPaletteCustomColorsV1().filter((x) => x !== normalizeHex6(hex))]
      writeChartColorPaletteCustomColorsV1(next)
      renderCustomRow()
    })
    customRow.appendChild(addBtn)
    markActiveCustomRow()
  }
  if (showCustomColorsRow) renderCustomRow()

  const { row: opacityRow, label: opacityLabel } = createChartColorPaletteSettingRowV1(doc, 'Opacity')
  let range = null
  let num = null
  if (showOpacity) {
    const controls = createChartColorPaletteOpacityControlsV1(doc, opacity)
    range = controls.range
    num = controls.numberInput
    const syncRangeTrack = () => {
      const preview = blendHexOnWhite(hex, opacity)
      range.style.background = `linear-gradient(90deg, #e2e8f0 0%, ${preview} 100%)`
    }
    const applyOpacity = (v) => {
      opacity = clamp(v, 0, 1)
      range.value = String(Math.round(opacity * 100))
      num.value = `${Math.round(opacity * 100)}%`
      syncRangeTrack()
      if (customPane.dataset.visible === 'true') refreshCustomUi()
      emit()
    }
    range.addEventListener('input', () => applyOpacity(Number(range.value) / 100))
    const commitNumOpacity = () => {
      const raw = String(num.value).replace(/%/g, '').trim()
      const n = Number(raw)
      if (Number.isFinite(n)) applyOpacity(n / 100)
      else num.value = `${Math.round(opacity * 100)}%`
    }
    num.addEventListener('change', commitNumOpacity)
    num.addEventListener('blur', commitNumOpacity)
    opacityRow.append(opacityLabel, controls.wrap)
    syncRangeTrack()
  }

  const { row: thickRow, label: thickLabel } = createChartColorPaletteSettingRowV1(doc, 'Thickness')
  if (showThickness) {
    const seg = createChartColorPaletteSegmentV1(doc)
    for (let w = 1; w <= thicknessSteps; w += 1) {
      const { button: b, line } = createChartColorPaletteSegmentButtonV1(doc)
      line.style.borderBottomWidth = `${clamp(w, 1, 6)}px`
      b.addEventListener('click', () => {
        thickness = w
        ;[...seg.children].forEach((ch) => ch.setAttribute('data-active', ch === b ? 'true' : 'false'))
        emit()
      })
      b.setAttribute('data-active', w === thickness ? 'true' : 'false')
      seg.appendChild(b)
    }
    thickRow.append(thickLabel, seg)
  }

  const { row: lineRow, label: lineLabel } = createChartColorPaletteSettingRowV1(doc, 'Line style')
  if (showLineStyle) {
    const seg = createChartColorPaletteSegmentV1(doc)
    const defs = [
      ['solid', ''],
      ['dashed', 'ff-chart-color-palette-popover-v1__seg-line--dash'],
      ['dotted', 'ff-chart-color-palette-popover-v1__seg-line--dot'],
    ]
    defs.forEach(([key, cls]) => {
      const { button: b } = createChartColorPaletteSegmentButtonV1(doc, cls)
      b.addEventListener('click', () => {
        lineStyle = key
        ;[...seg.children].forEach((ch) => ch.setAttribute('data-active', ch === b ? 'true' : 'false'))
        emit()
      })
      b.setAttribute('data-active', key === lineStyle ? 'true' : 'false')
      seg.appendChild(b)
    })
    lineRow.append(lineLabel, seg)
  }

  if (showPresetGrid) presetsStack.appendChild(grid)
  if (showCustomColorsRow) presetsStack.appendChild(customRow)
  if (showOpacity) presetsStack.appendChild(opacityRow)
  if (showThickness) presetsStack.appendChild(thickRow)
  if (showLineStyle) presetsStack.appendChild(lineRow)

  const { hexRow, hexPreview, hexInput, hexAdd, svWrap, sv, svCursor, hue, hueCursor } =
    createChartColorPaletteCustomPickerDomV1(doc)

  function placeSvCursor() {
    const rect = sv.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const x = hsv.s * rect.width
    const y = (1 - hsv.v) * rect.height
    svCursor.style.left = `${x}px`
    svCursor.style.top = `${y}px`
  }

  function placeHueCursor() {
    const rect = hue.getBoundingClientRect()
    if (rect.height <= 0) return
    const y = (hsv.h / 360) * rect.height
    hueCursor.style.top = `${Math.round(y - 2)}px`
  }

  function refreshCustomUi() {
    if (showOpacity) setOpacityPreviewWithCheckerboard(hexPreview, hex, opacity)
    else {
      clearOpacityPreviewLayers(hexPreview)
      hexPreview.style.backgroundColor = hex
    }
    hexInput.value = hex
    setChartColorPaletteSvPlaneBackgroundV1(sv, hsv.h)
    placeSvCursor()
    placeHueCursor()
  }

  const applyHsvToHex = () => {
    hex = normalizeHex6(hsvToRgbHex(hsv.h, hsv.s, hsv.v))
    markActiveSwatch()
    refreshCustomUi()
    emit()
  }

  bindChartColorPaletteCustomPickerV1({
    sv,
    hue,
    hexInput,
    hexAdd,
    getHsv: () => hsv,
    setHsv: (next) => {
      hsv = next
    },
    getHex: () => hex,
    setHex: (next) => {
      hex = next
    },
    syncHsvFromHex,
    applyHsvToHex,
    markActiveSwatch,
    refreshCustomUi,
    renderCustomRow,
    emit,
    showCustomColorsRow,
  })

  customPane.append(hexRow, svWrap)

  if (showCustomPicker) {
    column.append(tabBar)
    tabBar.append(tabPreset, tabCustom)
  }
  column.appendChild(presetsStack)
  if (showCustomPicker) column.appendChild(customPane)
  root.appendChild(column)

  function emit() {
    const out = { hex, opacity }
    if (showThickness) out.thickness = thickness
    if (showLineStyle) {
      out.lineStyle = lineStyle
      out.lineStyleLw = lineStyleUiToLw(lineStyle)
    }
    const opaqueHex = opacity >= 0.999 ? hex : blendHexOnWhite(hex, opacity)
    out.hexOpaque = opaqueHex
    opts.onPick(out)
    markActiveSwatch()
    markActiveCustomRow()
    if (showOpacity && range) {
      const preview = blendHexOnWhite(hex, opacity)
      range.style.background = `linear-gradient(90deg, #e2e8f0 0%, ${preview} 100%)`
    }
  }

  doc.body.appendChild(root)
  positionChartColorPalettePopoverV1(root, opts.anchorEl)

  const st = getChartColorPalettePopoverStateV1(doc)
  st.el = root
  st.anchor = opts.anchorEl
  st.finalize = () => emit()
  // 闃舵 G锛氬脊绐楁墦寮€鏃朵富鍔ㄧ粰 anchor 鍐欍€屾墦寮€鎬併€嶆爣璁帮紝
  markChartColorPaletteAnchorOpenV1(opts.anchorEl)

  const popoverEvents = bindChartColorPalettePopoverEventsV1({
    doc,
    root,
    anchorEl: opts.anchorEl,
    state: st,
    tabPreset,
    tabCustom,
    presetsStack,
    customPane,
    onCustomTabOpen: () => {
      syncHsvFromHex()
      refreshCustomUi()
      requestAnimationFrame(() => {
        placeSvCursor()
        placeHueCursor()
      })
    },
  })

  syncHsvFromHex()
  refreshCustomUi()
  emit()

  return {
    close: () => closeChartColorPalettePopoverV1(doc),
    updatePosition: () => popoverEvents.updatePosition(),
  }
}

/**
 * @param {object} p
 * @param {Document} p.doc
 * @param {string} p.initialHex
 * @param {string} p.title
 * @param {object} [p.features]
 * @param {boolean} [p.features.opacity]
 * @param {boolean} [p.features.thickness]
 * @param {number} [p.features.thicknessSteps]
 * @param {boolean} [p.features.lineStyle]
 * @param {boolean} [p.features.customColorsRow]
 * @param {boolean} [p.features.customPicker]
 * @param {number} [p.initialThickness]
 * @param {() => number} [p.resolveInitialThickness] 鎵撳紑鑹叉澘鏃跺彇褰撳墠绾垮锛堥伩鍏嶆梺璺嚎瀹?input 宸叉敼浣?popover 浠嶇敤鎸傝浇鍒濆€硷級
 * @param {string} [p.initialLineStyle]
 * @param {'tile'|'line'|'background'} [p.variant] tile=绾壊鏂瑰潡锛沴ine=绾胯壊+妯嚎锛沚ackground=鑳屾櫙鑹插潡 34脳34 / 24脳24锛屾棤妯嚎
 * @param {{ chromaHex: string, opacity: number }} [p.initialPickMeta] 鑷?store 鎭㈠锛堥潰鏉挎暣鏍?replaceChildren 鍚庨棴鍖呬細涓級
 * @param {(out: object) => void} [p.onExtendedPick]  thickness / lineStyleLw 绛夛紙鍦ㄥ啓鍥為鑹插悗瑙﹀彂锛?
 */

export function createChartColorSwatchHostV1(p) {
  return createChartColorSwatchHostCoreV1(p, { openPopover: openChartColorPalettePopoverV1 })
}
