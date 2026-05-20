import {
  applySwatchLineBarPreviewV1,
  clamp,
  clearOpacityPreviewLayers,
  normalizeHex6,
  setOpacityPreviewWithCheckerboard,
} from './chartColorMathV1.js'
import { ensureChartColorPaletteStyles } from './chartColorPaletteStylesV1.js'

export function createChartColorSwatchHostCoreV1(p, deps = {}) {
  const doc = p.doc
  const openPopover = typeof deps.openPopover === 'function' ? deps.openPopover : () => ({ close() {} })
  ensureChartColorPaletteStyles(doc)

  const host = doc.createElement('span')
  host.className = 'ff-chart-color-swatch-host-v1'
  host.style.display = 'inline-flex'
  host.style.verticalAlign = 'middle'
  host.style.position = 'relative'

  const input = doc.createElement('input')
  input.type = 'color'
  input.className = 'ff-indicators-input-panel-v1__color-swatch ff-chart-color-swatch-host-v1__native'
  input.value = normalizeHex6(p.initialHex)
  /** 与 `input.value`（常为 hexOpaque）分离：重开色板需恢复滑块与「纯色」，否则会反复 blend 已混合色。 */
  let rememberedChromaHex = null
  let rememberedOpacity = null
  const seed = p.initialPickMeta
  if (seed && typeof seed === 'object') {
    const ch0 = seed.chromaHex
    const op0 = Number(seed.opacity)
    if (
      typeof ch0 === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(String(ch0).trim()) &&
      Number.isFinite(op0)
    ) {
      rememberedChromaHex = normalizeHex6(ch0)
      rememberedOpacity = clamp(op0, 0, 1)
    }
  }
  input.title = p.title
  input.setAttribute('tabindex', '-1')
  input.setAttribute('aria-hidden', 'true')
  Object.assign(input.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none',
    clip: 'rect(0 0 0 0)',
  })

  const lineVariant = p.variant === 'line'
  const backgroundVariant = p.variant === 'background'
  const btn = doc.createElement('button')
  btn.type = 'button'
  btn.title = p.title
  btn.setAttribute('aria-expanded', 'false')
  let chip = null
  let bar = null
  if (lineVariant) {
    btn.className = 'ff-chart-color-swatch-host-v1__btn ff-chart-color-swatch-host-v1__btn--line'
    chip = doc.createElement('span')
    chip.className = 'ff-chart-color-swatch-host-v1__chip'
    bar = doc.createElement('span')
    bar.className = 'ff-chart-color-swatch-host-v1__bar'
    btn.append(chip, bar)
  } else if (backgroundVariant) {
    btn.className = 'ff-chart-color-swatch-host-v1__btn ff-chart-color-swatch-host-v1__btn--background'
    chip = doc.createElement('span')
    chip.className = 'ff-chart-color-swatch-host-v1__chip'
    btn.appendChild(chip)
  } else {
    btn.className = 'ff-indicators-input-panel-v1__color-swatch ff-chart-color-swatch-host-v1__btn'
    btn.style.backgroundColor = input.value
  }

  const feat = p.features ?? {}
  const showOpacity = feat.opacity !== false
  const showThickness = feat.thickness === true
  const showLineStyle = feat.lineStyle === true
  const showCustomColorsRow = feat.customColorsRow === true
  const showCustomPicker = feat.customPicker === true
  const thicknessSteps = clamp(Math.round(Number(feat.thicknessSteps ?? 4)), 1, 8)
  let previewThickness = clamp(Math.round(Number(p.initialThickness ?? 2)), 1, thicknessSteps)
  let previewLineStyleUi = ['solid', 'dashed', 'dotted'].includes(p.initialLineStyle)
    ? p.initialLineStyle
    : 'solid'

  const syncBtn = () => {
    const hexOpaque = input.value
    const hasPickMeta =
      typeof rememberedOpacity === 'number' &&
      Number.isFinite(rememberedOpacity) &&
      typeof rememberedChromaHex === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(String(rememberedChromaHex).trim())

    if (lineVariant && chip && bar) {
      if (hasPickMeta) setOpacityPreviewWithCheckerboard(chip, rememberedChromaHex, rememberedOpacity)
      else {
        clearOpacityPreviewLayers(chip)
        chip.style.backgroundColor = hexOpaque
      }
      clearOpacityPreviewLayers(bar)
      applySwatchLineBarPreviewV1(bar, hexOpaque, previewThickness, previewLineStyleUi)
    } else if (backgroundVariant && chip) {
      if (hasPickMeta) setOpacityPreviewWithCheckerboard(chip, rememberedChromaHex, rememberedOpacity)
      else {
        clearOpacityPreviewLayers(chip)
        chip.style.backgroundColor = hexOpaque
      }
    } else {
      btn.style.backgroundColor = hexOpaque
    }
  }

  btn.addEventListener('click', (ev) => {
    ev.preventDefault()
    ev.stopPropagation()
    const thicknessOpen =
      typeof p.resolveInitialThickness === 'function'
        ? p.resolveInitialThickness()
        : p.initialThickness
    const hasRememberedPick =
      typeof rememberedOpacity === 'number' &&
      Number.isFinite(rememberedOpacity) &&
      typeof rememberedChromaHex === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(String(rememberedChromaHex).trim())
    openPopover({
      doc,
      anchorEl: btn,
      initialHex: hasRememberedPick ? normalizeHex6(rememberedChromaHex) : input.value,
      initialOpacity: hasRememberedPick ? clamp(rememberedOpacity, 0, 1) : 1,
      showOpacity,
      showThickness,
      showLineStyle,
      thicknessSteps,
      initialThickness: thicknessOpen,
      initialLineStyle: p.initialLineStyle,
      showCustomColorsRow,
      showCustomPicker,
      onPick: (out) => {
        rememberedChromaHex = out.hex != null ? normalizeHex6(out.hex) : null
        rememberedOpacity = typeof out.opacity === 'number' && Number.isFinite(out.opacity) ? clamp(out.opacity, 0, 1) : null
        if (showThickness && typeof out.thickness === 'number' && Number.isFinite(out.thickness)) {
          previewThickness = clamp(Math.round(out.thickness), 1, thicknessSteps)
        }
        if (showLineStyle && typeof out.lineStyle === 'string' && ['solid', 'dashed', 'dotted'].includes(out.lineStyle)) {
          previewLineStyleUi = out.lineStyle
        }
        input.value = out.hexOpaque ?? out.hex
        syncBtn()
        p.onExtendedPick?.(out)
        input.dispatchEvent(new Event('change', { bubbles: true }))
      },
    })
  })

  host.append(btn, input)
  syncBtn()

  Object.defineProperty(host, 'value', {
    configurable: true,
    get() {
      return input.value
    },
    set(v) {
      input.value = normalizeHex6(v)
      rememberedChromaHex = null
      rememberedOpacity = null
      syncBtn()
    },
  })

  const _add = host.addEventListener.bind(host)
  host.addEventListener = (type, listener, options) => {
    if (type === 'change') return input.addEventListener(type, listener, options)
    return _add(type, listener, options)
  }

  return host
}

