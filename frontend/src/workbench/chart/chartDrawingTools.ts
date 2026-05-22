import { LineType, PolygonType, registerOverlay } from 'klinecharts'
import type { Chart, DeepPartial, OverlayStyle } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { drawingToolCommandEvent, isDrawingToolCommandEvent } from '../rightDrawer/drawingToolCommands'

const horizontalLineOverlayName = 'ffHorizontalLine'
let horizontalLineOverlayRegistered = false
const selectedHandleColor = '#2962ff'
const selectedHandleDistanceFromScale = 102
const selectedHandleSize = 11
const hoverHandleSize = 12
const hoverHandleOuterSize = 14
const lockedHandleSize = 7

function colorWithAlpha(hex: string, opacity: number) {
  const normalized = hex.trim().replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return hex
  const value = Number.parseInt(normalized, 16)
  const alpha = Math.max(0, Math.min(Number.isFinite(opacity) ? opacity : 1, 1))
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function dashedValueForStyle(style: SettingsLineSwatchValue['lineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [6, 4]
  return [2, 2]
}

function lineTypeForStyle(style: SettingsLineSwatchValue['lineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function normalizeLineStyle(lineStyle: SettingsLineSwatchValue | undefined): SettingsLineSwatchValue {
  return {
    hex: typeof lineStyle?.hex === 'string' ? lineStyle.hex : '#0f766e',
    lineStyle: lineStyle?.lineStyle === 'dashed' || lineStyle?.lineStyle === 'dotted' ? lineStyle.lineStyle : 'solid',
    opacity: typeof lineStyle?.opacity === 'number' && Number.isFinite(lineStyle.opacity) ? Math.max(0, Math.min(lineStyle.opacity, 1)) : 1,
    thickness: typeof lineStyle?.thickness === 'number' && Number.isFinite(lineStyle.thickness) ? Math.max(1, Math.min(Math.round(lineStyle.thickness), 4)) : 1,
  }
}

function overlayStylesFromLine(lineStyle: SettingsLineSwatchValue): DeepPartial<OverlayStyle> {
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
      backgroundColor: color,
      borderColor: color,
    },
  }
}

function ensureHorizontalLineOverlay() {
  if (horizontalLineOverlayRegistered) return
  horizontalLineOverlayRegistered = true
  registerOverlay({
    name: horizontalLineOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ bounding, coordinates, overlay }) => {
      const y = coordinates[0]?.y
      if (!Number.isFinite(y)) return []
      const extendData = overlay.extendData as {
        hovered?: boolean
        lineStyle?: SettingsLineSwatchValue
        locked?: boolean
        pressed?: boolean
        selected?: boolean
      } | undefined
      const lineStyle = normalizeLineStyle(extendData?.lineStyle)
      const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
      const selected = extendData?.selected === true
      const hovered = extendData?.hovered === true
      const locked = extendData?.locked === true
      const active = selected || hovered
      const handleX = Math.max(0, bounding.width - selectedHandleDistanceFromScale)
      const figures: Array<{ attrs: Record<string, unknown>; styles?: Record<string, unknown>; type: string }> = [{
        type: 'line',
        styles: {
          color,
          dashedValue: dashedValueForStyle(lineStyle.lineStyle),
          size: lineStyle.thickness,
          style: lineTypeForStyle(lineStyle.lineStyle),
        },
        attrs: {
          coordinates: [
            { x: 0, y },
            { x: bounding.width, y },
          ],
        },
      }]
      if (locked && active) {
        figures.push({
          type: 'circle',
          attrs: { x: handleX, y, r: lockedHandleSize / 2 },
          styles: {
            borderColor: selectedHandleColor,
            borderSize: 1,
            color: '#ffffff',
            style: PolygonType.StrokeFill,
          },
        })
      } else if (selected) {
        figures.push({
          type: 'rect',
          attrs: {
            height: selectedHandleSize,
            width: selectedHandleSize,
            x: handleX - selectedHandleSize / 2,
            y: y - selectedHandleSize / 2,
          },
          styles: {
            borderColor: selectedHandleColor,
            borderRadius: 4,
            borderSize: 2,
            color: '#ffffff',
            style: PolygonType.StrokeFill,
          },
        })
      } else if (hovered) {
        figures.push({
          type: 'rect',
          attrs: {
            height: hoverHandleOuterSize,
            width: hoverHandleOuterSize,
            x: handleX - hoverHandleOuterSize / 2,
            y: y - hoverHandleOuterSize / 2,
          },
          styles: {
            borderColor: 'rgba(41, 98, 255, 0.3)',
            borderRadius: 4,
            borderSize: 3,
            color: 'rgba(255,255,255,0)',
            style: PolygonType.Stroke,
          },
        }, {
          type: 'rect',
          attrs: {
            height: hoverHandleSize,
            width: hoverHandleSize,
            x: handleX - hoverHandleSize / 2,
            y: y - hoverHandleSize / 2,
          },
          styles: {
            borderColor: selectedHandleColor,
            borderRadius: 4,
            borderSize: 1,
            color: '#ffffff',
            style: PolygonType.StrokeFill,
          },
        })
      }
      return figures
    },
  })
}

export function installChartDrawingTools(chart: Chart) {
  ensureHorizontalLineOverlay()
  let pendingOverlayId: string | null = null

  const updateOverlayState = (id: string | undefined, patch: Record<string, unknown>) => {
    if (!id) return
    const overlay = chart.getOverlayById(id)
    if (!overlay) return
    chart.overrideOverlay({
      id,
      extendData: {
        ...(overlay.extendData ?? {}),
        ...patch,
      },
    })
  }

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return

    if (event.detail.action === 'release') {
      if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
      pendingOverlayId = null
      return
    }

    const lineStyle = event.detail.lineStyle
    if (!lineStyle) return

    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    const overlayId = chart.createOverlay({
      name: horizontalLineOverlayName,
      extendData: {
        hovered: false,
        lineStyle: normalizeLineStyle(lineStyle),
        locked: event.detail.locked === true,
        pressed: false,
        selected: false,
      },
      styles: overlayStylesFromLine(lineStyle),
      onDrawEnd: () => {
        pendingOverlayId = null
        return false
      },
      onDeselected: ({ overlay }) => {
        updateOverlayState(overlay.id, { selected: false })
        return false
      },
      onMouseEnter: ({ overlay }) => {
        updateOverlayState(overlay.id, { hovered: true })
        return false
      },
      onMouseLeave: ({ overlay }) => {
        updateOverlayState(overlay.id, { hovered: false })
        return false
      },
      onPressedMoveEnd: ({ overlay }) => {
        updateOverlayState(overlay.id, { pressed: false })
        return false
      },
      onPressedMoveStart: ({ overlay }) => {
        updateOverlayState(overlay.id, { pressed: true })
        return false
      },
      onPressedMoving: ({ overlay }) => {
        return (overlay.extendData as { locked?: boolean } | null)?.locked === true
      },
      onSelected: ({ overlay }) => {
        updateOverlayState(overlay.id, { selected: true })
        return false
      },
    }, 'candle_pane')
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
  }

  window.addEventListener(drawingToolCommandEvent, handleCommand)
  return () => {
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    window.removeEventListener(drawingToolCommandEvent, handleCommand)
  }
}
