import { LineType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { readSettingsSymbolState } from '../settingsSymbolState'
import { resolveLineStyle, resolveLineThickness, resolveSwatchColor } from './chartStyleReaders'

export function applyGridStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const mode = typeof state['layout.grid.mode'] === 'string' ? state['layout.grid.mode'] : 'both'
  const verticalColor = resolveSwatchColor(state['layout.grid.vertical.color'], '#eef2f7')
  const horizontalColor = resolveSwatchColor(state['layout.grid.horizontal.color'], '#eef2f7')
  const showVertical = mode === 'both' || mode === 'vertical'
  const showHorizontal = mode === 'both' || mode === 'horizontal'

  chart.setStyles({
    grid: {
      show: showVertical || showHorizontal,
      horizontal: { color: horizontalColor, dashedValue: [2, 2], show: showHorizontal, size: 1, style: LineType.Solid },
      vertical: { color: verticalColor, dashedValue: [2, 2], show: showVertical, size: 1, style: LineType.Solid },
    },
  })
}

export function applyPaneSeparatorStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const swatch = state['layout.paneSeparator.color']
  const color = resolveSwatchColor(swatch, '#858b98')
  const size = resolveLineThickness(swatch)

  chart.setStyles({
    separator: {
      activeBackgroundColor: 'rgba(33, 150, 243, 0.08)',
      color,
      fill: true,
      size,
    },
  })
}

export function applyCrosshairLineStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const swatch = state['layout.crosshair.color']
  const color = resolveSwatchColor(swatch, '#e91e63')
  const line = resolveLineStyle(swatch)
  const size = resolveLineThickness(swatch)

  chart.setStyles({
    crosshair: {
      horizontal: { line: { color, dashedValue: line.dashedValue, show: true, size, style: line.style } },
      vertical: { line: { color, dashedValue: line.dashedValue, show: true, size, style: line.style } },
    },
  })
}
