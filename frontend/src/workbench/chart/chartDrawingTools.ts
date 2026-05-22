import { ActionType, DomPosition, LineType, PolygonType, registerFigure, registerOverlay } from 'klinecharts'
import type { Chart, DeepPartial, OverlayStyle } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { drawingToolCommandEvent, isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import {
  clearStoredHorizontalLineDrawings,
  normalizeDrawingLineStyle,
  normalizeDrawingTextStyle,
  readDrawingPersistence,
  readStoredHorizontalLineDrawings,
  writeStoredHorizontalLineDrawings,
} from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle, StoredHorizontalLineDrawing } from '../rightDrawer/drawingPersistence'
import { isStoredVisibilityRangePeriodVisible, visibilityRangeChangedEvent } from '../visibilityRange/visibilityRangeModel'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'

const horizontalLineOverlayName = 'ffHorizontalLine'
const horizontalLineTextFigureName = 'ffHorizontalLineText'
let horizontalLineOverlayRegistered = false
let horizontalLineTextFigureRegistered = false
const selectedHandleColor = '#2962ff'
const selectedHandleDistanceFromScale = 102
const selectedHandleSize = 12
const selectedHandleBorderSize = 2
const selectedHandleRadius = 3
const hoverHandleSize = 12
const hoverHandleBorderSize = 1
const horizontalLineHitSlop = 6
const lockedHandleSize = 7
const lockedHandleBorderSize = 1
const lockedHandleGap = 2
const priceLabelRightInset = 8
const horizontalLineVisibilityRangeKey = 'drawing:horizontalLine'
export const chartDrawingVisibilityRefreshEvent = 'fractalframe:chart-drawing-visibility-refresh'
const textMiddleLineGap = 5
const textTopLineGap = 1
const textBottomLineGap = 5
const textMiddleYOffset = 1

type CursorRestore = {
  cursor: string
  element: HTMLElement
}

type HorizontalLineExtendData = {
  hovered?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  pressed?: boolean
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: DrawingTextStyle
}

type HorizontalLineFigure = {
  attrs: Record<string, unknown>
  ignoreEvent?: boolean
  key?: string
  styles?: Record<string, unknown>
  type: string
}

function isCoordinate(value: Partial<{ x: number; y: number }> | Array<Partial<{ x: number; y: number }>>): value is Partial<{ x: number; y: number }> {
  return !Array.isArray(value)
}

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
  return normalizeDrawingLineStyle(lineStyle, '#0f766e')
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
      ...createPriceAxisLabelTextStyle(),
      backgroundColor: color,
      borderColor: 'transparent',
      borderSize: 0,
      color: '#ffffff',
      style: PolygonType.Fill,
    },
  }
}

function formatOverlayPrice(value: number, pricePrecision: number, thousandsSeparator: string) {
  const precision = Number.isFinite(pricePrecision) ? Math.max(0, Math.min(Math.round(pricePrecision), 10)) : 2
  const fixed = value.toFixed(precision)
  const [integer, decimal] = fixed.split('.')
  const grouped = thousandsSeparator
    ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)
    : integer
  return decimal == null ? grouped : `${grouped}.${decimal}`
}

function resolveHorizontalLineTextLayout(textStyle: DrawingTextStyle | undefined, y: number, left: number, right: number, measure: (value: string, font: string) => number) {
  const text = normalizeDrawingTextStyle(textStyle)
  if (!text.body.trim()) return null
  const fontStyle = text.italic ? 'italic ' : ''
  const fontWeight = text.bold ? '700 ' : '400 '
  const font = `${fontStyle}${fontWeight}${text.fontSize}px Arial, Tahoma, sans-serif`
  const rows = text.body.split(/\r?\n/)
  const width = rows.reduce((max, row) => Math.max(max, measure(row, font)), 0)
  const x = text.alignH === 'left'
    ? left + 8
    : text.alignH === 'center'
      ? (left + right) / 2
      : right - 8
  const textY = text.alignV === 'top'
    ? y - textTopLineGap
    : text.alignV === 'bottom'
      ? y + textBottomLineGap
      : y + textMiddleYOffset
  return {
    ...text,
    font,
    lineHeight: Math.round(text.fontSize * 1.25),
    rows,
    width,
    x,
    y: textY,
  }
}

function textLayoutBounds(layout: ReturnType<typeof resolveHorizontalLineTextLayout>) {
  if (!layout) return null
  const left = layout.alignH === 'left'
    ? layout.x
    : layout.alignH === 'center'
      ? layout.x - layout.width / 2
      : layout.x - layout.width
  return { left, right: left + layout.width }
}

function measureCanvasText(value: string, font: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return value.length * 8
  ctx.font = font
  return Number(ctx.measureText(value).width) || value.length * 8
}

function ensureHorizontalLineTextFigure() {
  if (horizontalLineTextFigureRegistered) return
  horizontalLineTextFigureRegistered = true
  registerFigure({
    name: horizontalLineTextFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: {
      left: number
      right: number
      textStyle?: DrawingTextStyle
      y: number
    }) => {
      const layout = resolveHorizontalLineTextLayout(
        attrs.textStyle,
        attrs.y,
        attrs.left,
        attrs.right,
        (value, font) => {
          ctx.save()
          ctx.font = font
          const width = Number(ctx.measureText(value).width) || value.length * 8
          ctx.restore()
          return width
        },
      )
      if (!layout) return
      ctx.save()
      ctx.font = layout.font
      ctx.fillStyle = layout.textColor
      ctx.textAlign = layout.alignH
      ctx.textBaseline = layout.alignV === 'top' ? 'bottom' : layout.alignV === 'bottom' ? 'top' : 'middle'
      const offsetStart = layout.rows.length > 1 ? -((layout.rows.length - 1) * layout.lineHeight) / 2 : 0
      layout.rows.forEach((row, index) => {
        ctx.fillText(row, layout.x, layout.y + (layout.alignV === 'middle' ? offsetStart + index * layout.lineHeight : index * layout.lineHeight))
      })
      ctx.restore()
    },
  })
}

function collectCursorElements(root: HTMLElement) {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
}

function setCursor(elements: HTMLElement[], cursor: string) {
  const restore: CursorRestore[] = []
  elements.forEach((element) => {
    restore.push({ cursor: element.style.cursor, element })
    element.style.cursor = cursor
  })
  return () => {
    restore.forEach(({ cursor: previousCursor, element }) => {
      element.style.cursor = previousCursor
    })
  }
}

function ensureHorizontalLineOverlay() {
  if (horizontalLineOverlayRegistered) return
  ensureHorizontalLineTextFigure()
  horizontalLineOverlayRegistered = true
  registerOverlay({
    name: horizontalLineOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ bounding, coordinates, overlay }) => {
      const y = coordinates[0]?.y
      if (!Number.isFinite(y)) return []
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      const lineStyle = normalizeLineStyle(extendData?.lineStyle)
      const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
      const selected = extendData?.selected === true
      const hovered = extendData?.hovered === true
      const locked = extendData?.locked === true
      const active = selected || hovered
      const handleX = Math.max(0, bounding.width - selectedHandleDistanceFromScale)
      const textLayout = resolveHorizontalLineTextLayout(extendData?.textStyle, y, 0, bounding.width, measureCanvasText)
      const textBounds = textLayout?.alignV === 'middle' ? textLayoutBounds(textLayout) : null
      const textGap = textBounds ? { left: textBounds.left - textMiddleLineGap, right: textBounds.right + textMiddleLineGap } : null
      const figures: HorizontalLineFigure[] = [{
        type: 'rect',
        styles: {
          borderSize: 0,
          color: 'rgba(0,0,0,0)',
          style: PolygonType.Fill,
        },
        attrs: {
          height: horizontalLineHitSlop * 2,
          width: bounding.width,
          x: 0,
          y: y - horizontalLineHitSlop,
        },
      }]
      const lineStyles = {
        color,
        dashedValue: dashedValueForStyle(lineStyle.lineStyle),
        size: lineStyle.thickness,
        style: lineTypeForStyle(lineStyle.lineStyle),
      }
      const pushLine = (x1: number, x2: number) => {
        if (x2 <= x1) return
        figures.push({
          type: 'line',
          styles: lineStyles,
          attrs: {
            coordinates: [
              { x: x1, y },
              { x: x2, y },
            ],
          },
        })
      }
      if (locked && active) {
        const lockedHandleGapHalf = lockedHandleSize / 2 + lockedHandleGap
        const gaps = [
          { left: handleX - lockedHandleGapHalf, right: handleX + lockedHandleGapHalf },
          textGap,
        ].filter((gap): gap is { left: number; right: number } => Boolean(gap))
          .sort((a, b) => a.left - b.left)
        let cursor = 0
        gaps.forEach((gap) => {
          const left = Math.max(0, gap.left)
          const right = Math.min(bounding.width, gap.right)
          pushLine(cursor, left)
          cursor = Math.max(cursor, right)
        })
        pushLine(cursor, bounding.width)
      } else {
        if (textGap) {
          pushLine(0, Math.max(0, textGap.left))
          pushLine(Math.min(bounding.width, textGap.right), bounding.width)
        } else {
          pushLine(0, bounding.width)
        }
      }
      if (locked && active) {
        figures.push({
          type: 'circle',
          attrs: { x: handleX, y, r: lockedHandleSize / 2 },
          styles: {
            borderColor: selectedHandleColor,
            borderSize: lockedHandleBorderSize,
            color: '#ffffff',
            style: PolygonType.StrokeFill,
          },
        })
      } else if (selected) {
        const innerHandleSize = selectedHandleSize - selectedHandleBorderSize * 2
        figures.push({
          type: 'rect',
          key: 'handle',
          attrs: {
            height: selectedHandleSize,
            width: selectedHandleSize,
            x: handleX - selectedHandleSize / 2,
            y: y - selectedHandleSize / 2,
          },
          styles: {
            borderRadius: selectedHandleRadius,
            borderSize: 0,
            color: selectedHandleColor,
            style: PolygonType.Fill,
          },
        }, {
          type: 'rect',
          attrs: {
            height: innerHandleSize,
            width: innerHandleSize,
            x: handleX - innerHandleSize / 2,
            y: y - innerHandleSize / 2,
          },
          styles: {
            borderRadius: Math.max(0, selectedHandleRadius - 1),
            borderSize: 0,
            color: '#ffffff',
            style: PolygonType.Fill,
          },
        })
      } else if (hovered) {
        figures.push({
          type: 'rect',
          key: 'handle',
          attrs: {
            height: hoverHandleSize,
            width: hoverHandleSize,
            x: handleX - hoverHandleSize / 2,
            y: y - hoverHandleSize / 2,
          },
          styles: {
            borderColor: selectedHandleColor,
            borderRadius: selectedHandleRadius,
            borderSize: hoverHandleBorderSize,
            color: '#ffffff',
            style: PolygonType.StrokeFill,
          },
        })
      }
      if (textLayout) {
        figures.push({
          type: horizontalLineTextFigureName,
          attrs: {
            left: 0,
            right: bounding.width,
            textStyle: extendData?.textStyle,
            y,
          },
          ignoreEvent: true,
        })
      }
      return figures
    },
    createYAxisFigures: ({ bounding, coordinates, overlay, precision, thousandsSeparator }) => {
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (extendData?.showPriceLabel === false) return []
      const y = coordinates[0]?.y
      const value = Number(overlay.points[0]?.value)
      if (!Number.isFinite(y) || !Number.isFinite(value)) return []
      const lineStyle = normalizeLineStyle(extendData?.lineStyle)
      return [{
        type: 'text',
        attrs: {
          align: 'right',
          baseline: 'middle',
          text: formatOverlayPrice(value, precision.price, thousandsSeparator),
          x: bounding.width - priceLabelRightInset,
          y,
        },
        ignoreEvent: true,
        styles: {
          ...createPriceAxisLabelTextStyle(),
          backgroundColor: colorWithAlpha(lineStyle.hex, lineStyle.opacity),
          color: '#ffffff',
        },
      }]
    },
  })
}

export function installChartDrawingTools(chart: Chart, getPeriod: () => string = () => '') {
  ensureHorizontalLineOverlay()
  let pendingOverlayId: string | null = null
  let selectedOverlayId: string | null = null
  let lastSelectedOverlayId: string | null = null
  let restoreHoverCursor: (() => void) | null = null
  const horizontalLineOverlayIds = new Set<string>()
  let persistenceEnabled = readDrawingPersistence('horizontalLine')
  let horizontalLineVisible = true
  let destroyed = false

  const applyHoverCursor = () => {
    restoreHoverCursor?.()
    const paneMain = chart.getDom('candle_pane', DomPosition.Main)
    if (!paneMain) return
    restoreHoverCursor = setCursor(collectCursorElements(paneMain), 'pointer')
  }

  const clearHoverCursor = () => {
    restoreHoverCursor?.()
    restoreHoverCursor = null
  }

  const publishState = (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => {
    const stateSelected = state?.selected
    const fallbackOverlayId = stateSelected !== false ? resolveSelectedOverlayId() : null
    const primaryOverlay = selectedOverlayId ? chart.getOverlayById(selectedOverlayId) : null
    const fallbackOverlay = fallbackOverlayId ? chart.getOverlayById(fallbackOverlayId) : null
    const selectedOverlay = primaryOverlay ?? fallbackOverlay
    if (selectedOverlay) selectedOverlayId = selectedOverlay.id
    const selectedExtendData = selectedOverlay?.extendData as HorizontalLineExtendData | null
    const selectedPrice = Number(selectedOverlay?.points[0]?.value)
    publishDrawingToolState({
      armed: pendingOverlayId != null,
      lineStyle: selectedExtendData?.lineStyle ? normalizeLineStyle(selectedExtendData.lineStyle) : undefined,
      locked: Boolean(selectedExtendData?.locked),
      price: Number.isFinite(selectedPrice) ? selectedPrice : undefined,
      selected: selectedOverlay != null,
      showPriceLabel: selectedExtendData?.showPriceLabel !== false,
      textStyle: selectedExtendData?.textStyle ? normalizeDrawingTextStyle(selectedExtendData.textStyle) : undefined,
      tool: 'horizontalLine',
      ...state,
    })
  }

  const persistCurrentHorizontalLines = () => {
    if (destroyed) return
    if (!persistenceEnabled) return
    const drawings: StoredHorizontalLineDrawing[] = []
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        horizontalLineOverlayIds.delete(id)
        return
      }
      const value = Number(overlay.points[0]?.value)
      if (!Number.isFinite(value)) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      drawings.push({
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        value,
      })
    })
    writeStoredHorizontalLineDrawings(drawings)
  }

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

  const resolveDeleteTargetOverlayId = () => {
    if (selectedOverlayId && chart.getOverlayById(selectedOverlayId)) return selectedOverlayId
    if (lastSelectedOverlayId && chart.getOverlayById(lastSelectedOverlayId)) return lastSelectedOverlayId
    return null
  }

  const resolveSelectedOverlayId = () => {
    if (selectedOverlayId && chart.getOverlayById(selectedOverlayId)) return selectedOverlayId
    if (!lastSelectedOverlayId) return null
    const lastSelectedOverlay = chart.getOverlayById(lastSelectedOverlayId)
    const lastSelectedExtendData = lastSelectedOverlay?.extendData as HorizontalLineExtendData | undefined
    return lastSelectedExtendData?.selected === true ? lastSelectedOverlayId : null
  }

  const resolveEditableOverlayId = () => resolveSelectedOverlayId()

  const isHorizontalLineVisibleInCurrentPeriod = () => isStoredVisibilityRangePeriodVisible(horizontalLineVisibilityRangeKey, getPeriod())

  const applyHorizontalLineVisibility = () => {
    const visible = isHorizontalLineVisibleInCurrentPeriod()
    horizontalLineVisible = visible
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      chart.overrideOverlay({ id, visible })
      if (!visible) updateOverlayState(id, { hovered: false, pressed: false, selected: false })
    })
    if (!visible) {
      selectedOverlayId = null
      clearHoverCursor()
      publishState({ selected: false })
    }
  }

  const eventHitsHorizontalLine = (event: MouseEvent) => {
    const paneMain = chart.getDom('candle_pane', DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventY = event.clientY - rect.top
    if (!Number.isFinite(eventY)) return false
    for (const id of horizontalLineOverlayIds) {
      const overlay = chart.getOverlayById(id)
      const value = Number(overlay?.points[0]?.value)
      if (!Number.isFinite(value)) continue
      const pixel = chart.convertToPixel({ value }, { paneId: 'candle_pane' })
      const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
      const y = Number(coordinate?.y)
      if (Number.isFinite(y) && Math.abs(eventY - y) <= horizontalLineHitSlop) return true
    }
    return false
  }

  const clearHorizontalLineSelection = () => {
    let changed = false
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      updateOverlayState(id, { hovered: false, pressed: false, selected: false })
    })
    if (!changed && !selectedOverlayId) return
    selectedOverlayId = null
    clearHoverCursor()
    publishState({ selected: false })
  }

  const handlePaneClick = (event: MouseEvent) => {
    window.setTimeout(() => {
      if (destroyed) return
      if (eventHitsHorizontalLine(event)) return
      clearHorizontalLineSelection()
    }, 0)
  }

  const createHorizontalLineOverlay = ({
    lineStyle,
    locked,
    points,
    selected,
    showPriceLabel,
    textStyle,
  }: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => chart.createOverlay({
    name: horizontalLineOverlayName,
    extendData: {
      hovered: false,
      lineStyle: normalizeLineStyle(lineStyle),
      locked,
      pressed: false,
      selected,
      showPriceLabel,
      textStyle: normalizeDrawingTextStyle(textStyle),
    },
    lock: locked,
    points,
    styles: overlayStylesFromLine(lineStyle),
    visible: horizontalLineVisible,
    onDrawEnd: ({ overlay }) => {
      pendingOverlayId = null
      selectedOverlayId = overlay.id
      lastSelectedOverlayId = overlay.id
      horizontalLineOverlayIds.add(overlay.id)
      updateOverlayState(overlay.id, { selected: true })
      persistCurrentHorizontalLines()
      publishState({ armed: false, locked, selected: true })
      return false
    },
    onRemoved: ({ overlay }) => {
      horizontalLineOverlayIds.delete(overlay.id)
      if (selectedOverlayId === overlay.id) selectedOverlayId = null
      if (lastSelectedOverlayId === overlay.id) lastSelectedOverlayId = null
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      return false
    },
    onDeselected: ({ overlay }) => {
      updateOverlayState(overlay.id, { selected: false })
      if (selectedOverlayId === overlay.id) selectedOverlayId = null
      publishState({ selected: false })
      return false
    },
    onMouseEnter: ({ overlay }) => {
      updateOverlayState(overlay.id, { hovered: true })
      applyHoverCursor()
      return false
    },
    onMouseLeave: ({ overlay }) => {
      updateOverlayState(overlay.id, { hovered: false })
      clearHoverCursor()
      return false
    },
    onPressedMoveEnd: ({ overlay }) => {
      updateOverlayState(overlay.id, { pressed: false })
      persistCurrentHorizontalLines()
      publishState({ selected: true })
      return false
    },
    onPressedMoveStart: ({ overlay }) => {
      selectedOverlayId = overlay.id
      lastSelectedOverlayId = overlay.id
      updateOverlayState(overlay.id, { pressed: true, selected: true })
      publishState({
        locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
        selected: true,
      })
      return false
    },
    onPressedMoving: ({ overlay }) => {
      return (overlay.extendData as { locked?: boolean } | null)?.locked === true
    },
    onSelected: ({ overlay }) => {
      selectedOverlayId = overlay.id
      lastSelectedOverlayId = overlay.id
      updateOverlayState(overlay.id, { selected: true })
      publishState({
        locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
        selected: true,
      })
      return false
    },
  }, 'candle_pane')

  if (persistenceEnabled) {
    readStoredHorizontalLineDrawings().forEach((drawing) => {
      const overlayId = createHorizontalLineOverlay({
        lineStyle: drawing.lineStyle,
        locked: drawing.locked,
        points: [{ value: drawing.value }],
        selected: false,
        showPriceLabel: drawing.showPriceLabel,
        textStyle: drawing.textStyle,
      })
      if (typeof overlayId === 'string') horizontalLineOverlayIds.add(overlayId)
    })
  }
  applyHorizontalLineVisibility()

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return

    if (event.detail.action === 'release') {
      if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
      pendingOverlayId = null
      publishState({ armed: false })
      return
    }

    if (event.detail.action === 'refreshSelectedState') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) {
        publishState({ selected: false })
        return
      }
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      publishState({ selected: true })
      return
    }

    if (event.detail.action === 'deleteSelected') {
      const deleteTargetOverlayId = resolveDeleteTargetOverlayId()
      if (deleteTargetOverlayId) chart.removeOverlay({ id: deleteTargetOverlayId })
      if (selectedOverlayId === deleteTargetOverlayId) selectedOverlayId = null
      if (lastSelectedOverlayId === deleteTargetOverlayId) lastSelectedOverlayId = null
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      return
    }

    if (event.detail.action === 'toggleSelectedLock') {
      if (!selectedOverlayId) return
      const overlay = chart.getOverlayById(selectedOverlayId)
      const locked = !Boolean((overlay?.extendData as { locked?: boolean } | null)?.locked)
      updateOverlayState(selectedOverlayId, { locked })
      chart.overrideOverlay({ id: selectedOverlayId, lock: locked })
      persistCurrentHorizontalLines()
      publishState({ locked, selected: true })
      return
    }

    if (event.detail.action === 'updatePersistence') {
      persistenceEnabled = event.detail.persisted !== false
      if (persistenceEnabled) {
        persistCurrentHorizontalLines()
      } else {
        clearStoredHorizontalLineDrawings()
      }
      return
    }

    if (event.detail.action === 'updateSelectedLineStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !event.detail.lineStyle) return
      const lineStyle = normalizeLineStyle(event.detail.lineStyle)
      updateOverlayState(editableOverlayId, { lineStyle })
      chart.overrideOverlay({
        id: editableOverlayId,
        styles: overlayStylesFromLine(lineStyle),
      })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ lineStyle, selected: true })
      return
    }

    if (event.detail.action === 'updateSelectedPriceLabel') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) return
      const showPriceLabel = event.detail.showPriceLabel !== false
      updateOverlayState(editableOverlayId, { showPriceLabel })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ selected: true, showPriceLabel } as Partial<{ armed: boolean; locked: boolean; selected: boolean; showPriceLabel: boolean }>)
      return
    }

    if (event.detail.action === 'updateSelectedPrice') {
      const editableOverlayId = resolveEditableOverlayId()
      const price = Number(event.detail.price)
      if (!editableOverlayId || !Number.isFinite(price)) return
      const overlay = chart.getOverlayById(editableOverlayId)
      if (!overlay || (overlay.extendData as HorizontalLineExtendData | undefined)?.locked === true) return
      chart.overrideOverlay({
        id: editableOverlayId,
        points: [{
          ...(overlay.points[0] ?? {}),
          value: price,
        }],
      })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ price, selected: true })
      return
    }

    if (event.detail.action === 'updateSelectedTextStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !event.detail.textStyle) return
      const textStyle = normalizeDrawingTextStyle(event.detail.textStyle)
      updateOverlayState(editableOverlayId, { textStyle })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ selected: true, textStyle } as Partial<{ armed: boolean; locked: boolean; selected: boolean; textStyle: DrawingTextStyle }>)
      return
    }

    const lineStyle = event.detail.lineStyle
    if (!lineStyle) return

    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    const overlayId = createHorizontalLineOverlay({
      lineStyle,
      locked: event.detail.locked === true,
      selected: false,
      showPriceLabel: event.detail.showPriceLabel !== false,
      textStyle: event.detail.textStyle,
    })
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
    applyHorizontalLineVisibility()
    publishState({ armed: pendingOverlayId != null, selected: selectedOverlayId != null })
  }

  const handleVisibilityRangeChanged = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as { key?: string } : {}
    if (detail.key && detail.key !== horizontalLineVisibilityRangeKey) return
    applyHorizontalLineVisibility()
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || !event.key.includes(horizontalLineVisibilityRangeKey)) return
    applyHorizontalLineVisibility()
  }

  const handleDataReady = () => {
    applyHorizontalLineVisibility()
  }

  const handleVisibilityRefresh = () => {
    applyHorizontalLineVisibility()
  }

  window.addEventListener(drawingToolCommandEvent, handleCommand)
  window.addEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
  window.addEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
  window.addEventListener('storage', handleStorage)
  chart.subscribeAction(ActionType.OnDataReady, handleDataReady)
  chart.getDom('candle_pane', DomPosition.Main)?.addEventListener('click', handlePaneClick, true)
  return () => {
    destroyed = true
    clearHoverCursor()
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    window.removeEventListener(drawingToolCommandEvent, handleCommand)
    window.removeEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
    window.removeEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
    window.removeEventListener('storage', handleStorage)
    chart.unsubscribeAction(ActionType.OnDataReady, handleDataReady)
    chart.getDom('candle_pane', DomPosition.Main)?.removeEventListener('click', handlePaneClick, true)
  }
}
