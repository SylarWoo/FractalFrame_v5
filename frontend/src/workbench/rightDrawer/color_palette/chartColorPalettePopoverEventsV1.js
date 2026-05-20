import { positionChartColorPalettePopoverV1 } from './chartColorPalettePositionV1.js'
import { closeChartColorPalettePopoverV1 } from './chartColorPalettePopoverStateV1.js'

export function bindChartColorPalettePopoverEventsV1({
  doc = null,
  root = null,
  anchorEl = null,
  state = null,
  tabPreset = null,
  tabCustom = null,
  presetsStack = null,
  customPane = null,
  onCustomTabOpen = null,
} = {}) {
  if (!doc || !root || !anchorEl || !state) {
    return {
      setTab() {},
      updatePosition() {},
    }
  }

  const updatePosition = () => {
    if (state.el && state.anchor) positionChartColorPalettePopoverV1(state.el, state.anchor)
  }

  const setTab = (which) => {
    const presetOn = which === 'preset'
    tabPreset?.setAttribute('data-active', presetOn ? 'true' : 'false')
    tabCustom?.setAttribute('data-active', presetOn ? 'false' : 'true')
    if (presetsStack) presetsStack.style.display = presetOn ? '' : 'none'
    if (customPane) customPane.dataset.visible = presetOn ? 'false' : 'true'
    if (!presetOn && typeof onCustomTabOpen === 'function') onCustomTabOpen()
  }

  tabPreset?.addEventListener('click', () => setTab('preset'))
  tabCustom?.addEventListener('click', () => setTab('custom'))

  state.onReposition = updatePosition
  window.addEventListener('scroll', state.onReposition, true)
  window.addEventListener('resize', state.onReposition)

  state.onDocDown = (ev) => {
    if (root.contains(ev.target) || anchorEl.contains?.(ev.target) || anchorEl === ev.target) return
    closeChartColorPalettePopoverV1(doc)
  }
  doc.addEventListener('mousedown', state.onDocDown, true)

  state.onKey = (ev) => {
    if (ev.key === 'Escape') closeChartColorPalettePopoverV1(doc)
  }
  doc.addEventListener('keydown', state.onKey, true)

  return { setTab, updatePosition }
}
