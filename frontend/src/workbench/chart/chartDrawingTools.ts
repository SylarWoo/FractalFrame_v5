import { ActionType, DomPosition, LineType, PolygonType, registerFigure, registerOverlay } from 'klinecharts'
import type { Chart, DeepPartial, OverlayStyle } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { drawingToolCommandEvent, isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { isObjectTreeDrawingCommandEvent, objectTreeDrawingCommandEvent, objectTreeDrawingsRequestEvent, publishObjectTreeDrawings } from '../rightDrawer/objectTree/objectTreeModel'
import {
  clearStoredHorizontalLineDrawings,
  normalizeDrawingLineStyle,
  normalizeDrawingTextStyle,
  normalizeDrawingTrendLineStyle,
  readDrawingPersistence,
  readStoredHorizontalLineDrawings,
  writeStoredHorizontalLineDrawings,
} from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle, StoredHorizontalLineDrawing } from '../rightDrawer/drawingPersistence'
import { isStoredVisibilityRangePeriodVisible, visibilityRangeChangedEvent } from '../visibilityRange/visibilityRangeModel'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'

const horizontalLineOverlayName = 'ffHorizontalLine'
const horizontalLineTextFigureName = 'ffHorizontalLineText'
const trendLineOverlayName = 'ffTrendLine'
const trendLineHitFigureName = 'ffTrendLineHit'
let horizontalLineOverlayRegistered = false
let horizontalLineTextFigureRegistered = false
let trendLineOverlayRegistered = false
let trendLineHitFigureRegistered = false
const candlePaneId = 'candle_pane'
const knownDrawingPaneIds = [candlePaneId, 'rsi_pane', 'stoch_pane', 'macd_pane', 'tsi_pane', 'vi_pane']
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
const trendHandleColor = '#2962ff'
const trendHandleRadius = 5.5
const trendHandleLineWidth = 2
const trendLockedHandleRadius = 3
const trendLockedHandleLineWidth = 1
const trendMiddleHandleRadius = 3
const trendMiddleHandleLineWidth = 1
const horizontalLineVisibilityRangeKey = 'drawing:horizontalLine'
const horizontalLineVisibilityRangeKeyPrefix = `${horizontalLineVisibilityRangeKey}:`
export const chartDrawingVisibilityRefreshEvent = 'fractalframe:chart-drawing-visibility-refresh'
const textMiddleLineGap = 5
const textTopLineGap = 1
const textBottomLineGap = 5
const textMiddleYOffset = 1
let horizontalLineObjectIdSeed = 0

type CursorRestore = {
  cursor: string
  element: HTMLElement
}

type HorizontalLineExtendData = {
  hovered?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  manualVisible?: boolean
  objectId?: string
  periodVisible?: boolean
  pressed?: boolean
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: DrawingTextStyle
}

type TrendLineExtendData = {
  drawing?: boolean
  endpointPressed?: boolean
  pressedPointIndex?: number
  hovered?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  pressed?: boolean
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: DrawingTextStyle
  trendLineStyle?: DrawingTrendLineStyle
}

type HorizontalLineFigure = {
  attrs: Record<string, unknown>
  ignoreEvent?: boolean
  key?: string
  styles?: Record<string, unknown>
  type: string
}

type HorizontalLineMoveEntry = {
  id: string
  startValue: number
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

function trendOverlayStylesFromLine(lineStyle: SettingsLineSwatchValue): DeepPartial<OverlayStyle> {
  return {
    ...overlayStylesFromLine(lineStyle),
    point: {
      activeBorderColor: 'rgba(0,0,0,0)',
      activeBorderSize: 0,
      activeColor: 'rgba(0,0,0,0)',
      activeRadius: 10,
      borderColor: 'rgba(0,0,0,0)',
      borderSize: 0,
      color: 'rgba(0,0,0,0)',
      radius: 10,
    },
  }
}

type ScreenPoint = { x: number; y: number }

function isScreenPoint(value: Partial<ScreenPoint> | undefined): value is ScreenPoint {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y)
}

function resolveTrendLineBoundsEndpoint(origin: ScreenPoint, through: ScreenPoint, bounding: { height: number; width: number }, reverse: boolean): ScreenPoint {
  const dx = through.x - origin.x
  const dy = through.y - origin.y
  const candidates: Array<{ point: ScreenPoint; t: number }> = []
  const pushCandidate = (t: number) => {
    if (!Number.isFinite(t)) return
    const x = origin.x + dx * t
    const y = origin.y + dy * t
    if (x >= 0 && x <= bounding.width && y >= 0 && y <= bounding.height) candidates.push({ point: { x, y }, t })
  }
  if (dx !== 0) {
    pushCandidate((0 - origin.x) / dx)
    pushCandidate((bounding.width - origin.x) / dx)
  }
  if (dy !== 0) {
    pushCandidate((0 - origin.y) / dy)
    pushCandidate((bounding.height - origin.y) / dy)
  }
  const directional = candidates
    .filter(({ t }) => reverse ? t <= 0 : t >= 0)
    .sort((a, b) => reverse ? a.t - b.t : b.t - a.t)
  return directional[0]?.point ?? origin
}

function resolveTrendLineEndpoints(start: ScreenPoint, end: ScreenPoint, bounding: { height: number; width: number }, extendMode: DrawingTrendLineStyle['extendMode']) {
  if (extendMode === 'none') return { end, start }
  return {
    end: extendMode === 'right' || extendMode === 'both'
      ? resolveTrendLineBoundsEndpoint(start, end, bounding, false)
      : end,
    start: extendMode === 'left' || extendMode === 'both'
      ? resolveTrendLineBoundsEndpoint(end, start, bounding, false)
      : start,
  }
}

function createTrendArrowFigures(tip: ScreenPoint, from: ScreenPoint, color: string, size: number): HorizontalLineFigure[] {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const length = 12
  const spread = Math.PI / 7
  const left = {
    x: tip.x - Math.cos(angle - spread) * length,
    y: tip.y - Math.sin(angle - spread) * length,
  }
  const right = {
    x: tip.x - Math.cos(angle + spread) * length,
    y: tip.y - Math.sin(angle + spread) * length,
  }
  return [{
    type: 'line',
    attrs: { coordinates: [left, tip, right] },
    styles: {
      color,
      dashedValue: [],
      size,
      style: LineType.Solid,
    },
  }]
}

function createTrendHandleFigure(point: ScreenPoint, locked: boolean, selected: boolean, color = trendHandleColor): HorizontalLineFigure {
  const borderSize = locked
    ? trendLockedHandleLineWidth
    : selected
      ? trendHandleLineWidth
      : 1
  const outerRadius = trendHandleRadius + trendHandleLineWidth / 2
  const radius = locked
    ? trendLockedHandleRadius
    : outerRadius - borderSize / 2
  return {
    type: 'circle',
    attrs: {
      r: radius,
      x: point.x,
      y: point.y,
    },
    styles: {
      borderColor: color,
      borderSize,
      color: '#ffffff',
      style: PolygonType.StrokeFill,
    },
  }
}

function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq))
  const projected = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  }
  return Math.hypot(point.x - projected.x, point.y - projected.y)
}

function ensureTrendLineHitFigure() {
  if (trendLineHitFigureRegistered) return
  trendLineHitFigureRegistered = true
  registerFigure({
    name: trendLineHitFigureName,
    checkEventOn: (coordinate: unknown, attrs: unknown) => {
      const point = coordinate as Partial<ScreenPoint>
      const hitAttrs = attrs as { coordinates?: ScreenPoint[]; hitSlop?: number }
      const start = hitAttrs.coordinates?.[0]
      const end = hitAttrs.coordinates?.[1]
      const hitSlop = Number(hitAttrs.hitSlop)
      if (!isScreenPoint(point) || !isScreenPoint(start) || !isScreenPoint(end)) return false
      return distanceToSegment(point, start, end) <= (Number.isFinite(hitSlop) ? hitSlop : 8)
    },
    draw: () => undefined,
  })
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

function resolveHorizontalLineLabelPrecision(paneId: string | undefined, pricePrecision: number) {
  if (paneId === 'macd_pane' || paneId === 'vi_pane') return 4
  if (paneId === 'rsi_pane' || paneId === 'stoch_pane' || paneId === 'tsi_pane') return 2
  return pricePrecision
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

function createHorizontalLineObjectId() {
  horizontalLineObjectIdSeed += 1
  return `HL${String(horizontalLineObjectIdSeed).padStart(4, '0')}`
}

function numericObjectIdValue(objectId: string) {
  const match = /^HL(\d+)$/i.exec(objectId.trim())
  return match ? Number(match[1]) : Number.NaN
}

function syncHorizontalLineObjectIdSeed(drawings: StoredHorizontalLineDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) horizontalLineObjectIdSeed = Math.max(horizontalLineObjectIdSeed, value)
  })
}

function horizontalLineObjectVisibilityRangeKey(objectId: string | undefined) {
  return objectId ? `${horizontalLineVisibilityRangeKeyPrefix}${objectId}` : horizontalLineVisibilityRangeKey
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
      if (extendData?.manualVisible === false || extendData?.periodVisible === false) return []
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
    createYAxisFigures: ({ coordinates, overlay, precision, thousandsSeparator }) => {
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (extendData?.manualVisible === false || extendData?.periodVisible === false) return []
      if (extendData?.showPriceLabel === false) return []
      const y = coordinates[0]?.y
      const value = Number(overlay.points[0]?.value)
      if (!Number.isFinite(y) || !Number.isFinite(value)) return []
      const lineStyle = normalizeLineStyle(extendData?.lineStyle)
      const labelPrecision = resolveHorizontalLineLabelPrecision(overlay.paneId, precision.price)
      return [{
        type: 'text',
        attrs: {
          align: 'left',
          baseline: 'middle',
          text: formatOverlayPrice(value, labelPrecision, thousandsSeparator),
          x: 0,
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

function ensureTrendLineOverlay() {
  if (trendLineOverlayRegistered) return
  ensureTrendLineHitFigure()
  trendLineOverlayRegistered = true
  registerOverlay({
    name: trendLineOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ bounding, coordinates, overlay }) => {
      const start = coordinates[0]
      const end = coordinates[1]
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      const locked = extendData?.locked === true
      const drawing = extendData?.drawing === true
      if (!isScreenPoint(start)) return []
      if (!isScreenPoint(end)) return drawing ? [createTrendHandleFigure(start, locked, true)] : []
      const lineStyle = normalizeLineStyle(extendData?.lineStyle)
      const trendStyle = normalizeDrawingTrendLineStyle(extendData?.trendLineStyle)
      const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
      const size = Math.max(1, Math.min(Math.round(lineStyle.thickness), 4))
      const endpointPressed = extendData?.endpointPressed === true
      const pressedPointIndex = Number(extendData?.pressedPointIndex)
      const active = !endpointPressed && (extendData?.selected === true || extendData?.hovered === true || extendData?.pressed === true)
      const selected = extendData?.selected === true || extendData?.pressed === true
      const resolved = resolveTrendLineEndpoints(start, end, bounding, trendStyle.extendMode)
      const figures: HorizontalLineFigure[] = [{
        key: 'trend-hit-line',
        type: trendLineHitFigureName,
        attrs: {
          coordinates: [resolved.start, resolved.end],
          hitSlop: 12,
        },
      }, {
        type: 'line',
        attrs: {
          coordinates: [resolved.start, resolved.end],
        },
        styles: {
          color,
          dashedValue: dashedValueForStyle(lineStyle.lineStyle),
          size,
          style: lineTypeForStyle(lineStyle.lineStyle),
        },
      }]
      if (trendStyle.startMarker === 'arrow') figures.push(...createTrendArrowFigures(resolved.start, resolved.end, color, size))
      if (trendStyle.endMarker === 'arrow') figures.push(...createTrendArrowFigures(resolved.end, resolved.start, color, size))
      if (active || endpointPressed || drawing) {
        if (!endpointPressed || pressedPointIndex !== 0) figures.push(createTrendHandleFigure(start, locked, selected))
        if (!drawing && (!endpointPressed || pressedPointIndex !== 1)) figures.push(createTrendHandleFigure(end, locked, selected))
      }
      if (active && trendStyle.middleVisible) {
        figures.push({
          type: 'circle',
          attrs: {
            r: trendMiddleHandleRadius,
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
          },
          styles: {
            borderColor: color,
            borderSize: trendMiddleHandleLineWidth,
            color: '#ffffff',
            style: PolygonType.StrokeFill,
          },
        })
      }
      if (trendStyle.statsAlwaysVisible && trendStyle.statsData.length > 0) {
        const valueStart = Number(overlay.points[0]?.value)
        const valueEnd = Number(overlay.points[1]?.value)
        const valueDelta = Number.isFinite(valueStart) && Number.isFinite(valueEnd) ? valueEnd - valueStart : null
        const statsText = trendStyle.statsData.map((item) => {
          if (item === 'point-change' && valueDelta != null) return valueDelta.toFixed(4)
          if (item === 'percent-change' && valueDelta != null && valueStart !== 0) return `${((valueDelta / valueStart) * 100).toFixed(2)}%`
          if (item === 'price-range' && valueDelta != null) return `${Math.min(valueStart, valueEnd).toFixed(4)} - ${Math.max(valueStart, valueEnd).toFixed(4)}`
          if (item === 'bar-range') return `${Math.abs(Number(overlay.points[1]?.dataIndex ?? 0) - Number(overlay.points[0]?.dataIndex ?? 0))}`
          if (item === 'angle') return `${Math.round(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI)}°`
          return ''
        }).filter(Boolean).join('  ')
        if (statsText) {
          const x = trendStyle.statsPosition === 'left'
            ? Math.min(start.x, end.x)
            : trendStyle.statsPosition === 'right'
              ? Math.max(start.x, end.x)
              : (start.x + end.x) / 2
          figures.push({
            type: 'text',
            attrs: {
              align: trendStyle.statsPosition === 'left' ? 'left' : trendStyle.statsPosition === 'right' ? 'right' : 'center',
              baseline: 'bottom',
              text: statsText,
              x,
              y: Math.min(start.y, end.y) - 8,
            },
            styles: {
              backgroundColor: 'rgba(255,255,255,0.82)',
              color,
              size: 12,
            },
          })
        }
      }
      return figures
    },
  })
}

export function installChartDrawingTools(chart: Chart, getPeriod: () => string = () => '') {
  ensureHorizontalLineOverlay()
  ensureTrendLineOverlay()
  let pendingOverlayId: string | null = null
  let pendingTrendLineOverlayId: string | null = null
  let pendingOverlayOptions: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  } | null = null
  let pendingTrendLineOptions: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  } | null = null
  let selectedOverlayId: string | null = null
  let selectedTrendLineOverlayId: string | null = null
  let lastSelectedOverlayId: string | null = null
  let restoreHoverCursor: (() => void) | null = null
  let trendForcedCursor: { cursor: string; elements: HTMLElement[] } | null = null
  let pendingTrendStartHandle: HTMLDivElement | null = null
  let pendingTrendFirstPointPlaced = false
  const horizontalLineOverlayIds = new Set<string>()
  const trendLineOverlayIds = new Set<string>()
  const paneInteractionCleanups: Array<() => void> = []
  const registeredPaneInteractions = new Map<string, { cleanup: () => void; element: HTMLElement }>()
  let persistenceEnabled = readDrawingPersistence('horizontalLine')
  let pendingStoredHorizontalLineDrawings = persistenceEnabled ? readStoredHorizontalLineDrawings() : []
  syncHorizontalLineObjectIdSeed(pendingStoredHorizontalLineDrawings)
  let horizontalLineVisible = true
  let lastPointerPaneId = candlePaneId
  let additiveSelectionActive = false
  let pressedMoveState: { activeId: string; activeStartValue: number; entries: HorizontalLineMoveEntry[]; paneId: string } | null = null
  const selectedHorizontalLineOverlayIds = new Set<string>()
  let destroyed = false

  const applyHoverCursor = (paneId = candlePaneId) => {
    restoreHoverCursor?.()
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return
    restoreHoverCursor = setCursor(collectCursorElements(paneMain), 'pointer')
  }

  const clearHoverCursor = () => {
    restoreHoverCursor?.()
    restoreHoverCursor = null
  }

  const applyTrendForcedCursor = (paneId = candlePaneId, cursor = 'default') => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return
    const elements = collectCursorElements(paneMain)
    trendForcedCursor = { cursor, elements }
    const forceCursor = () => {
      elements.forEach((element) => {
        element.style.cursor = cursor
      })
    }
    forceCursor()
    window.setTimeout(forceCursor, 0)
    window.requestAnimationFrame(forceCursor)
  }

  const clearTrendForcedCursor = () => {
    const forced = trendForcedCursor
    if (!forced) return
    forced.elements.forEach((element) => {
      if (element.style.cursor === forced.cursor) element.style.cursor = ''
    })
    trendForcedCursor = null
  }

  const hidePendingTrendStartHandle = () => {
    pendingTrendStartHandle?.remove()
    pendingTrendStartHandle = null
  }

  const publishState = (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => {
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
      objectId: selectedExtendData?.objectId,
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
        manualVisible: extendData?.manualVisible !== false,
        objectId: extendData?.objectId || createHorizontalLineObjectId(),
        paneId: overlay.paneId || candlePaneId,
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
    if (typeof patch.selected === 'boolean') {
      if (patch.selected) selectedHorizontalLineOverlayIds.add(id)
      else selectedHorizontalLineOverlayIds.delete(id)
    }
    const visualStateOnly = Object.keys(patch).every((key) => key === 'hovered' || key === 'pressed' || key === 'selected')
    if (overlay.visible === false && visualStateOnly) return
    chart.overrideOverlay({
      id,
      extendData: {
        ...(overlay.extendData ?? {}),
        ...patch,
      },
      visible: overlay.visible,
    })
  }

  const getSelectedHorizontalLineIds = () => Array.from(horizontalLineOverlayIds).filter((id) => {
    return selectedHorizontalLineOverlayIds.has(id)
  })

  const setSelectedHorizontalLine = (id: string, additive: boolean) => {
    horizontalLineOverlayIds.forEach((overlayId) => {
      if (additive && overlayId !== id) return
      updateOverlayState(overlayId, { selected: overlayId === id })
    })
    selectedOverlayId = id
    lastSelectedOverlayId = id
  }

  const toggleSelectedHorizontalLine = (id: string) => {
    const selected = selectedHorizontalLineOverlayIds.has(id)
    updateOverlayState(id, { selected: !selected })
    selectedOverlayId = selected ? resolveSelectedOverlayId() : id
    lastSelectedOverlayId = selected ? selectedOverlayId : id
  }

  const resolvePointValueFromMoveEvent = (event: { x?: number; y?: number }, paneId: string) => {
    const y = Number(event.y)
    if (!Number.isFinite(y)) return Number.NaN
    const point = chart.convertFromPixel([{ y }], { paneId })
    const coordinate = Array.isArray(point) ? point[0] : point
    const value = Number(coordinate?.value)
    return Number.isFinite(value) ? value : Number.NaN
  }

  const beginPressedMove = (overlayId: string) => {
    const overlay = chart.getOverlayById(overlayId)
    if (!overlay) {
      pressedMoveState = null
      return
    }
    const paneId = overlay.paneId || candlePaneId
    const selectedIds = getSelectedHorizontalLineIds()
    const activeIsAlreadySelected = selectedIds.includes(overlayId)
    if (activeIsAlreadySelected && selectedIds.length > 1) {
      selectedOverlayId = overlayId
      lastSelectedOverlayId = overlayId
    } else {
      setSelectedHorizontalLine(overlayId, additiveSelectionActive)
    }

    const moveIds = getSelectedHorizontalLineIds()
    const entries = moveIds
      .map((id) => {
        const selectedOverlay = chart.getOverlayById(id)
        const extendData = selectedOverlay?.extendData as HorizontalLineExtendData | undefined
        if (!selectedOverlay || (selectedOverlay.paneId || candlePaneId) !== paneId || extendData?.locked === true || selectedOverlay.lock === true) return null
        const startValue = Number(selectedOverlay.points[0]?.value)
        return Number.isFinite(startValue) ? { id, startValue } : null
      })
      .filter((entry): entry is HorizontalLineMoveEntry => entry != null)
    const activeEntry = entries.find((entry) => entry.id === overlayId)
    pressedMoveState = activeEntry ? { activeId: overlayId, activeStartValue: activeEntry.startValue, entries, paneId } : null
  }

  const moveSelectedHorizontalLines = (event: { x?: number; y?: number }, overlayId: string) => {
    const moveState = pressedMoveState
    if (!moveState || moveState.activeId !== overlayId || moveState.entries.length <= 1) return false
    const value = resolvePointValueFromMoveEvent(event, moveState.paneId)
    if (!Number.isFinite(value)) return false
    const delta = value - moveState.activeStartValue
    moveState.entries.forEach((entry) => {
      const overlay = chart.getOverlayById(entry.id)
      if (!overlay) return
      chart.overrideOverlay({
        id: entry.id,
        points: [{
          ...(overlay.points[0] ?? {}),
          value: entry.startValue + delta,
        }],
      })
    })
    return true
  }

  const publishObjectTreeState = () => {
    publishObjectTreeDrawings(Array.from(horizontalLineOverlayIds)
      .map((id) => {
        const overlay = chart.getOverlayById(id)
        if (!overlay) return null
        const extendData = overlay.extendData as HorizontalLineExtendData | undefined
        const visibility = resolveHorizontalLineVisibility(extendData)
        return {
          id: extendData?.objectId || id,
          kind: 'horizontalLine' as const,
          label: '\u6c34\u5e73\u7ebf',
          locked: extendData?.locked === true || overlay.lock === true,
          manualVisible: visibility.manualVisible,
          overlayId: id,
          paneId: overlay.paneId || candlePaneId,
          periodVisible: visibility.periodVisible,
          selected: selectedHorizontalLineOverlayIds.has(id),
          visible: visibility.visible,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null))
  }

  const resolveDeleteTargetOverlayId = () => {
    if (selectedOverlayId && chart.getOverlayById(selectedOverlayId)) return selectedOverlayId
    if (lastSelectedOverlayId && chart.getOverlayById(lastSelectedOverlayId)) return lastSelectedOverlayId
    return null
  }

  const resolveSelectedOverlayId = () => {
    if (selectedOverlayId) {
      if (selectedHorizontalLineOverlayIds.has(selectedOverlayId)) return selectedOverlayId
    }
    if (!lastSelectedOverlayId) return null
    if (selectedHorizontalLineOverlayIds.has(lastSelectedOverlayId)) return lastSelectedOverlayId
    return selectedHorizontalLineOverlayIds.values().next().value ?? null
  }

  const resolveEditableOverlayId = () => resolveSelectedOverlayId()

  const isHorizontalLineVisibleInCurrentPeriod = (objectId?: string) => isStoredVisibilityRangePeriodVisible(horizontalLineObjectVisibilityRangeKey(objectId), getPeriod())

  const resolveHorizontalLineVisibility = (extendData: HorizontalLineExtendData | undefined) => {
    const manualVisible = extendData?.manualVisible !== false
    const periodVisible = isHorizontalLineVisibleInCurrentPeriod(extendData?.objectId)
    return {
      manualVisible,
      periodVisible,
      visible: manualVisible && periodVisible,
    }
  }

  const applyHorizontalLineVisibility = () => {
    horizontalLineVisible = true
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      const { manualVisible, periodVisible, visible } = resolveHorizontalLineVisibility(extendData)
      const selected = selectedHorizontalLineOverlayIds.has(id)
      if (overlay.visible !== manualVisible || extendData?.manualVisible !== manualVisible || extendData?.periodVisible !== periodVisible || extendData?.selected !== selected) {
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            manualVisible,
            periodVisible,
            selected,
          },
          visible: manualVisible,
        })
      }
      if (!visible) updateOverlayState(id, { hovered: false, pressed: false })
    })
    if (!selectedOverlayId) clearHoverCursor()
    if (!selectedOverlayId) publishState({ selected: false })
    publishObjectTreeState()
  }

  const eventHitsHorizontalLine = (event: MouseEvent, paneId: string) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventY = event.clientY - rect.top
    if (!Number.isFinite(eventY)) return false
    for (const id of horizontalLineOverlayIds) {
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || candlePaneId) !== paneId) continue
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (!resolveHorizontalLineVisibility(extendData).visible) continue
      const value = Number(overlay?.points[0]?.value)
      if (!Number.isFinite(value)) continue
      const pixel = chart.convertToPixel({ value }, { paneId })
      const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
      const y = Number(coordinate?.y)
      if (Number.isFinite(y) && Math.abs(eventY - y) <= horizontalLineHitSlop) return true
    }
    return false
  }

  const resolveOverlayPointPixel = (point: { dataIndex?: number; timestamp?: number; value?: number }, paneId: string) => {
    const value = Number(point?.value)
    if (!Number.isFinite(value)) return null
    const dataIndex = Number(point?.dataIndex)
    const timestamp = Number(point?.timestamp)
    const pixel = chart.convertToPixel({
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      value,
    }, { paneId })
    const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
    const x = Number(coordinate?.x)
    const y = Number(coordinate?.y)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }

  const updatePendingTrendStartHandle = (overlay: { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> }) => {
    const paneId = overlay.paneId || candlePaneId
    const point = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!point || !paneMain) {
      hidePendingTrendStartHandle()
      return
    }
    const rect = paneMain.getBoundingClientRect()
    if (!pendingTrendStartHandle) {
      pendingTrendStartHandle = document.createElement('div')
      pendingTrendStartHandle.style.position = 'fixed'
      pendingTrendStartHandle.style.width = '13px'
      pendingTrendStartHandle.style.height = '13px'
      pendingTrendStartHandle.style.border = `${trendHandleLineWidth}px solid ${trendHandleColor}`
      pendingTrendStartHandle.style.borderRadius = '50%'
      pendingTrendStartHandle.style.background = '#ffffff'
      pendingTrendStartHandle.style.boxSizing = 'border-box'
      pendingTrendStartHandle.style.pointerEvents = 'none'
      pendingTrendStartHandle.style.zIndex = '2147483647'
      document.body.appendChild(pendingTrendStartHandle)
    }
    pendingTrendStartHandle.style.left = `${rect.left + point.x - 6.5}px`
    pendingTrendStartHandle.style.top = `${rect.top + point.y - 6.5}px`
  }

  const schedulePendingTrendStartHandle = () => {
    const overlayId = pendingTrendLineOverlayId
    if (!overlayId) return
    window.setTimeout(() => {
      if (destroyed || pendingTrendLineOverlayId !== overlayId) return
      const overlay = chart.getOverlayById(overlayId)
      if (!overlay?.points?.[0]) return
      pendingTrendFirstPointPlaced = true
      updatePendingTrendStartHandle(overlay as { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> })
    }, 0)
  }

  const eventHitsTrendLine = (event: MouseEvent, paneId: string) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (!Number.isFinite(eventPoint.x) || !Number.isFinite(eventPoint.y)) return false
    for (const id of trendLineOverlayIds) {
      if (id === pendingTrendLineOverlayId) continue
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || candlePaneId) !== paneId) continue
      const start = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
      const end = resolveOverlayPointPixel(overlay.points[1] ?? {}, paneId)
      if (!start || !end) continue
      if (distanceToSegment(eventPoint, start, end) <= horizontalLineHitSlop) return true
    }
    return false
  }

  const eventHitsTrendLineEndpoint = (event: MouseEvent, paneId: string) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (!Number.isFinite(eventPoint.x) || !Number.isFinite(eventPoint.y)) return false
    const endpointHitSlop = 12
    for (const id of trendLineOverlayIds) {
      if (id === pendingTrendLineOverlayId) continue
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || candlePaneId) !== paneId) continue
      const start = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
      const end = resolveOverlayPointPixel(overlay.points[1] ?? {}, paneId)
      if ((start && Math.hypot(eventPoint.x - start.x, eventPoint.y - start.y) <= endpointHitSlop)
        || (end && Math.hypot(eventPoint.x - end.x, eventPoint.y - end.y) <= endpointHitSlop)) return true
    }
    return false
  }

  const clearHorizontalLineSelection = () => {
    let changed = false
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (!selectedHorizontalLineOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      updateOverlayState(id, { hovered: false, pressed: false, selected: false })
    })
    if (!changed && !selectedOverlayId) return
    selectedOverlayId = null
    selectedHorizontalLineOverlayIds.clear()
    clearHoverCursor()
    clearTrendForcedCursor()
    publishState({ selected: false })
    publishObjectTreeState()
  }

  const clearTrendLineSelection = () => {
    let changed = false
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      chart.overrideOverlay({
        id,
        extendData: {
          ...extendData,
          endpointPressed: false,
          hovered: false,
          pressed: false,
          pressedPointIndex: undefined,
          selected: false,
        },
      })
    })
    if (!changed && !selectedTrendLineOverlayId) return
    selectedTrendLineOverlayId = null
    clearHoverCursor()
    publishDrawingToolState({
      armed: pendingTrendLineOverlayId != null,
      locked: false,
      selected: false,
      showPriceLabel: true,
      tool: 'trendLine',
    })
  }

  const handlePaneClick = (event: MouseEvent, paneId: string) => {
    window.setTimeout(() => {
      if (destroyed) return
      if (eventHitsHorizontalLine(event, paneId)) return
      if (eventHitsTrendLine(event, paneId)) return
      clearHorizontalLineSelection()
      clearTrendLineSelection()
    }, 0)
  }

  const createHorizontalLineOverlay = ({
    lineStyle,
    locked,
    manualVisible = true,
    objectId = createHorizontalLineObjectId(),
    paneId = candlePaneId,
    points,
    selected,
    showPriceLabel,
    textStyle,
  }: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => chart.createOverlay({
    name: horizontalLineOverlayName,
    extendData: {
      drawing: true,
      hovered: false,
      lineStyle: normalizeLineStyle(lineStyle),
      locked,
      manualVisible,
      objectId,
      periodVisible: true,
      pressed: false,
      selected,
      showPriceLabel,
      textStyle: normalizeDrawingTextStyle(textStyle),
    },
    lock: locked,
    points,
    styles: overlayStylesFromLine(lineStyle),
    visible: horizontalLineVisible && manualVisible,
    onDrawEnd: ({ overlay }) => {
      pendingOverlayId = null
      pendingOverlayOptions = null
      selectedOverlayId = overlay.id
      lastSelectedOverlayId = overlay.id
      horizontalLineOverlayIds.add(overlay.id)
      setSelectedHorizontalLine(overlay.id, false)
      persistCurrentHorizontalLines()
      publishState({ armed: false, locked, selected: true })
      publishObjectTreeState()
      return false
    },
    onRemoved: ({ overlay }) => {
      horizontalLineOverlayIds.delete(overlay.id)
      selectedHorizontalLineOverlayIds.delete(overlay.id)
      if (selectedOverlayId === overlay.id) selectedOverlayId = null
      if (lastSelectedOverlayId === overlay.id) lastSelectedOverlayId = null
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      publishObjectTreeState()
      return false
    },
    onDeselected: ({ overlay }) => {
      if (additiveSelectionActive) return false
      if (overlay.visible === false) return false
      updateOverlayState(overlay.id, { selected: false })
      if (selectedOverlayId === overlay.id) selectedOverlayId = null
      publishState({ selected: false })
      publishObjectTreeState()
      return false
    },
    onMouseEnter: ({ overlay }) => {
      updateOverlayState(overlay.id, { hovered: true })
      applyHoverCursor(overlay.paneId || candlePaneId)
      return false
    },
    onMouseLeave: ({ overlay }) => {
      updateOverlayState(overlay.id, { hovered: false })
      clearHoverCursor()
      return false
    },
    onPressedMoveEnd: ({ overlay }) => {
      const movedIds = pressedMoveState?.entries.map((entry) => entry.id) ?? [overlay.id]
      movedIds.forEach((id) => updateOverlayState(id, { pressed: false }))
      pressedMoveState = null
      persistCurrentHorizontalLines()
      publishState({ selected: true })
      publishObjectTreeState()
      return false
    },
    onPressedMoveStart: ({ overlay }) => {
      beginPressedMove(overlay.id)
      updateOverlayState(overlay.id, { pressed: true, selected: true })
      publishState({
        locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
        selected: true,
      })
      publishObjectTreeState()
      return false
    },
    onPressedMoving: (event) => {
      const { overlay } = event
      if (overlay.lock === true || (overlay.extendData as { locked?: boolean } | null)?.locked === true) return true
      return moveSelectedHorizontalLines(event as { x?: number; y?: number }, overlay.id)
    },
    onSelected: ({ overlay }) => {
      setSelectedHorizontalLine(overlay.id, additiveSelectionActive)
      publishState({
        locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
        selected: true,
      })
      publishObjectTreeState()
      return false
    },
  }, paneId)

  const createTrendLineOverlay = ({
    lineStyle,
    locked,
    paneId = candlePaneId,
    selected,
    showPriceLabel,
    textStyle,
    trendLineStyle,
  }: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    paneId?: string
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  }) => chart.createOverlay({
    name: trendLineOverlayName,
    extendData: {
      hovered: false,
      lineStyle: normalizeLineStyle(lineStyle),
      locked,
      pressed: false,
      selected,
      showPriceLabel,
      textStyle: normalizeDrawingTextStyle(textStyle),
      trendLineStyle: normalizeDrawingTrendLineStyle(trendLineStyle),
    },
    lock: locked,
    styles: trendOverlayStylesFromLine(lineStyle),
    onDrawing: ({ overlay }) => {
      if (pendingTrendLineOverlayId === overlay.id && pendingTrendFirstPointPlaced) {
        updatePendingTrendStartHandle(overlay as { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> })
      }
      return false
    },
    onDrawEnd: ({ overlay }) => {
      hidePendingTrendStartHandle()
      pendingTrendFirstPointPlaced = false
      pendingTrendLineOverlayId = null
      pendingTrendLineOptions = null
      selectedTrendLineOverlayId = overlay.id
      trendLineOverlayIds.add(overlay.id)
      chart.overrideOverlay({
        id: overlay.id,
        extendData: {
          ...(overlay.extendData as TrendLineExtendData | undefined),
          drawing: false,
          selected: true,
        },
      })
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(lineStyle),
        locked,
        selected: true,
        showPriceLabel,
        textStyle: normalizeDrawingTextStyle(textStyle),
        tool: 'trendLine',
        trendLineStyle: normalizeDrawingTrendLineStyle(trendLineStyle),
      })
      return false
    },
    onRemoved: ({ overlay }) => {
      if (pendingTrendLineOverlayId === overlay.id) hidePendingTrendStartHandle()
      if (pendingTrendLineOverlayId === overlay.id) pendingTrendFirstPointPlaced = false
      if (pendingTrendLineOverlayId === overlay.id) pendingTrendLineOverlayId = null
      if (selectedTrendLineOverlayId === overlay.id) selectedTrendLineOverlayId = null
      trendLineOverlayIds.delete(overlay.id)
      return false
    },
    onMouseEnter: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, hovered: true } })
      clearHoverCursor()
      return false
    },
    onMouseLeave: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, hovered: false } })
      clearTrendForcedCursor()
      clearHoverCursor()
      return false
    },
    onPressedMoveEnd: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined } })
      clearTrendForcedCursor()
      return false
    },
    onPressedMoveStart: (event) => {
      const { overlay } = event
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      const paneId = overlay.paneId || candlePaneId
      const figureKey = typeof event.figureKey === 'string' ? event.figureKey : ''
      const endpointPressed = figureKey.includes('point_')
      const pointKeyMatch = /point_(\d+)/.exec(figureKey)
      const pressedPointIndex = endpointPressed
        ? Number.isInteger(event.figureIndex)
          ? event.figureIndex
          : pointKeyMatch
            ? Number(pointKeyMatch[1])
            : undefined
        : undefined
      selectedTrendLineOverlayId = overlay.id
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed, pressed: true, pressedPointIndex, selected: true } })
      applyTrendForcedCursor(paneId, endpointPressed ? 'default' : 'grabbing')
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'trendLine',
        trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
      })
      return false
    },
    onSelected: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      selectedTrendLineOverlayId = overlay.id
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'trendLine',
        trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
      })
      return false
    },
    onDeselected: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (selectedTrendLineOverlayId === overlay.id) selectedTrendLineOverlayId = null
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
      publishDrawingToolState({
        armed: pendingTrendLineOverlayId != null,
        locked: false,
        selected: false,
        showPriceLabel: true,
        tool: 'trendLine',
      })
      return false
    },
  }, paneId)

  const canCreateOverlayOnPane = (paneId: string) => paneId === candlePaneId || chart.getDom(paneId, DomPosition.Main) != null

  const restorePendingStoredHorizontalLines = () => {
    if (!persistenceEnabled || pendingStoredHorizontalLineDrawings.length === 0) return
    const remaining: StoredHorizontalLineDrawing[] = []
    pendingStoredHorizontalLineDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || candlePaneId
      if (!canCreateOverlayOnPane(paneId)) {
        remaining.push(drawing)
        return
      }
      const overlayId = createHorizontalLineOverlay({
        lineStyle: drawing.lineStyle,
        locked: drawing.locked,
        manualVisible: drawing.manualVisible,
        objectId: drawing.objectId || createHorizontalLineObjectId(),
        paneId,
        points: [{ value: drawing.value }],
        selected: false,
        showPriceLabel: drawing.showPriceLabel,
        textStyle: drawing.textStyle,
      })
      if (typeof overlayId === 'string') horizontalLineOverlayIds.add(overlayId)
    })
    pendingStoredHorizontalLineDrawings = remaining
  }

  restorePendingStoredHorizontalLines()
  applyHorizontalLineVisibility()
  publishObjectTreeState()

  const recreatePendingOverlayForPane = (paneId: string) => {
    if (!pendingOverlayId || !pendingOverlayOptions) return
    const overlay = chart.getOverlayById(pendingOverlayId)
    if (!overlay || (overlay.points?.length ?? 0) > 0 || (overlay.paneId || candlePaneId) === paneId) return
    chart.removeOverlay({ id: pendingOverlayId })
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId,
      selected: false,
    })
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
    publishState({ armed: pendingOverlayId != null })
  }

  const setPointerPane = (paneId: string) => {
    if (lastPointerPaneId === paneId) return
    lastPointerPaneId = paneId
    recreatePendingOverlayForPane(paneId)
  }

  const resolvePaneIdFromPointerEvent = (event: MouseEvent | PointerEvent) => {
    for (const paneId of knownDrawingPaneIds) {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) continue
      const rect = paneMain.getBoundingClientRect()
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) return paneId
    }
    return null
  }

  const handleRootPointer = (event: MouseEvent | PointerEvent) => {
    additiveSelectionActive = event.ctrlKey || event.metaKey
    const paneId = resolvePaneIdFromPointerEvent(event)
    if (paneId) {
      setPointerPane(paneId)
      if (pendingTrendLineOverlayId) {
        if (event.type === 'pointerdown') schedulePendingTrendStartHandle()
        clearTrendForcedCursor()
        return
      }
      const mouseEvent = event as MouseEvent
      if (eventHitsTrendLineEndpoint(mouseEvent, paneId)) {
        applyTrendForcedCursor(paneId, 'default')
      } else if (eventHitsTrendLine(mouseEvent, paneId)) {
        applyTrendForcedCursor(paneId, event.type === 'pointerdown' || event.buttons > 0 ? 'grabbing' : 'pointer')
      } else {
        clearTrendForcedCursor()
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = false
  }

  const ensurePaneInteractionListeners = () => {
    knownDrawingPaneIds.forEach((paneId) => {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) return
      const registered = registeredPaneInteractions.get(paneId)
      if (registered?.element === paneMain) return
      registered?.cleanup()
      const handleClick = (event: MouseEvent) => handlePaneClick(event, paneId)
      const handlePointer = () => setPointerPane(paneId)
      paneMain.addEventListener('click', handleClick, true)
      paneMain.addEventListener('mouseenter', handlePointer)
      paneMain.addEventListener('pointerenter', handlePointer)
      paneMain.addEventListener('mousemove', handlePointer)
      const cleanup = () => {
        paneMain.removeEventListener('click', handleClick, true)
        paneMain.removeEventListener('mouseenter', handlePointer)
        paneMain.removeEventListener('pointerenter', handlePointer)
        paneMain.removeEventListener('mousemove', handlePointer)
      }
      paneInteractionCleanups.push(cleanup)
      registeredPaneInteractions.set(paneId, { cleanup, element: paneMain })
    })
  }

  ensurePaneInteractionListeners()
  const chartRootDom = chart.getDom()
  chartRootDom?.addEventListener('pointerdown', handleRootPointer, true)
  chartRootDom?.addEventListener('pointermove', handleRootPointer, true)
  chartRootDom?.addEventListener('mousemove', handleRootPointer, true)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return

    if (event.detail.tool === 'trendLine') {
      if (event.detail.action === 'release') {
        if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
        hidePendingTrendStartHandle()
        pendingTrendFirstPointPlaced = false
        pendingTrendLineOverlayId = null
        pendingTrendLineOptions = null
        publishDrawingToolState({
          armed: false,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'trendLine',
        })
        return
      }

      if (event.detail.action === 'updateSelectedTrendLineStyle') {
        pendingTrendLineOptions = pendingTrendLineOptions && event.detail.trendLineStyle
          ? { ...pendingTrendLineOptions, trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle) }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId && event.detail.trendLineStyle) {
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
            },
          })
        }
        if (selectedTrendLineOverlayId && event.detail.trendLineStyle) {
          const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: selectedTrendLineOverlayId,
            extendData: {
              ...extendData,
              trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
            },
          })
        }
        return
      }

      if (event.detail.action === 'toggleSelectedLock') {
        if (!selectedTrendLineOverlayId) return
        const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
        if (!overlay) return
        const extendData = overlay.extendData as TrendLineExtendData | undefined
        const locked = extendData?.locked !== true
        chart.overrideOverlay({
          id: selectedTrendLineOverlayId,
          extendData: {
            ...extendData,
            locked,
            selected: true,
          },
          lock: locked,
        })
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updateSelectedLineStyle') {
        pendingTrendLineOptions = pendingTrendLineOptions && event.detail.lineStyle
          ? { ...pendingTrendLineOptions, lineStyle: normalizeLineStyle(event.detail.lineStyle) }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId && event.detail.lineStyle) {
          const lineStyle = normalizeLineStyle(event.detail.lineStyle)
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              lineStyle,
            },
            styles: trendOverlayStylesFromLine(lineStyle),
          })
        }
        if (selectedTrendLineOverlayId && event.detail.lineStyle) {
          const lineStyle = normalizeLineStyle(event.detail.lineStyle)
          const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: selectedTrendLineOverlayId,
            extendData: {
              ...extendData,
              lineStyle,
            },
            styles: trendOverlayStylesFromLine(lineStyle),
          })
        }
        return
      }

      if (event.detail.action !== 'start') return
      const lineStyle = event.detail.lineStyle
      if (!lineStyle) return
      if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
      hidePendingTrendStartHandle()
      pendingTrendFirstPointPlaced = false
      pendingTrendLineOptions = {
        lineStyle,
        locked: event.detail.locked === true,
        showPriceLabel: event.detail.showPriceLabel !== false,
        textStyle: event.detail.textStyle,
        trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
      }
      const overlayId = createTrendLineOverlay({
        ...pendingTrendLineOptions,
        paneId: lastPointerPaneId,
        selected: false,
      })
      pendingTrendLineOverlayId = typeof overlayId === 'string' ? overlayId : null
      if (pendingTrendLineOverlayId) trendLineOverlayIds.add(pendingTrendLineOverlayId)
      publishDrawingToolState({
        armed: pendingTrendLineOverlayId != null,
        lineStyle: normalizeLineStyle(lineStyle),
        locked: pendingTrendLineOptions.locked,
        selected: false,
        showPriceLabel: pendingTrendLineOptions.showPriceLabel,
        textStyle: normalizeDrawingTextStyle(pendingTrendLineOptions.textStyle),
        tool: 'trendLine',
        trendLineStyle: pendingTrendLineOptions.trendLineStyle,
      })
      return
    }

    if (event.detail.action === 'release') {
      if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
      pendingOverlayId = null
      pendingOverlayOptions = null
      publishState({ armed: false })
      return
    }

    if (event.detail.action === 'refreshSelectedState') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) {
        publishState({ selected: false })
        return
      }
      setSelectedHorizontalLine(editableOverlayId, false)
      publishState()
      publishObjectTreeState()
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
      publishObjectTreeState()
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
    pendingOverlayOptions = {
      lineStyle,
      locked: event.detail.locked === true,
      showPriceLabel: event.detail.showPriceLabel !== false,
      textStyle: event.detail.textStyle,
    }
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId: lastPointerPaneId,
      selected: false,
    })
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
    applyHorizontalLineVisibility()
    publishState({ armed: pendingOverlayId != null, selected: selectedOverlayId != null })
    publishObjectTreeState()
  }

  const handleObjectTreeCommand = (event: Event) => {
    if (!isObjectTreeDrawingCommandEvent(event)) return
    if (event.detail.action === 'deselectAll') {
      clearHorizontalLineSelection()
      clearTrendLineSelection()
      return
    }
    const command = event.detail
    const resolveObjectTreeOverlayId = (treeId: string) => {
      if (horizontalLineOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return treeId
      for (const overlayId of horizontalLineOverlayIds) {
        const treeOverlay = chart.getOverlayById(overlayId)
        const extendData = treeOverlay?.extendData as HorizontalLineExtendData | undefined
        if (extendData?.objectId === treeId) return overlayId
      }
      return null
    }
    const id = resolveObjectTreeOverlayId(command.id)
    if (!id) return
    if (!horizontalLineOverlayIds.has(id)) return
    const overlay = chart.getOverlayById(id)
    if (!overlay) return
    const resolveTargetIds = (ids: string[] | undefined) => (Array.isArray(ids) ? ids : [command.id])
      .map((targetId) => resolveObjectTreeOverlayId(targetId))
      .filter((targetId): targetId is string => Boolean(targetId))

    if (event.detail.action === 'delete') {
      const targetIds = resolveTargetIds(event.detail.ids)
      targetIds.forEach((targetId) => chart.removeOverlay({ id: targetId }))
      return
    }

    if (event.detail.action === 'setVisible') {
      const manualVisible = event.detail.visible
      const targetIds = resolveTargetIds(event.detail.ids)
      targetIds.forEach((targetId) => {
        const targetOverlay = chart.getOverlayById(targetId)
        if (!targetOverlay) return
        const targetExtendData = targetOverlay.extendData as HorizontalLineExtendData | undefined
        const periodVisible = isHorizontalLineVisibleInCurrentPeriod(targetExtendData?.objectId)
        const visible = manualVisible && periodVisible
        chart.overrideOverlay({
          id: targetId,
          extendData: {
            ...(targetOverlay.extendData ?? {}),
            manualVisible,
            periodVisible,
            selected: selectedHorizontalLineOverlayIds.has(targetId),
          },
          visible: manualVisible,
        })
        if (!visible) updateOverlayState(targetId, { hovered: false, pressed: false })
      })
      persistCurrentHorizontalLines()
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'setLocked') {
      const locked = event.detail.locked
      const targetIds = resolveTargetIds(event.detail.ids)
      targetIds.forEach((targetId) => {
        const targetOverlay = chart.getOverlayById(targetId)
        if (!targetOverlay) return
        chart.overrideOverlay({
          id: targetId,
          extendData: {
            ...(targetOverlay.extendData ?? {}),
            locked,
          },
          lock: locked,
        })
      })
      persistCurrentHorizontalLines()
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'select') {
      if (event.detail.additive === true) {
        toggleSelectedHorizontalLine(id)
      } else {
        setSelectedHorizontalLine(id, false)
      }
      publishState({ selected: true })
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'deselect') {
      updateOverlayState(id, { hovered: false, pressed: false, selected: false })
      if (selectedOverlayId === id) selectedOverlayId = null
      publishState({ selected: false })
      publishObjectTreeState()
    }
  }

  const handleVisibilityRangeChanged = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as { key?: string } : {}
    if (detail.key && detail.key !== horizontalLineVisibilityRangeKey && !detail.key.startsWith(horizontalLineVisibilityRangeKeyPrefix)) return
    applyHorizontalLineVisibility()
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || !event.key.includes(horizontalLineVisibilityRangeKey)) return
    applyHorizontalLineVisibility()
  }

  const handleDataReady = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    applyHorizontalLineVisibility()
  }

  const handleVisibilityRefresh = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    applyHorizontalLineVisibility()
  }

  const handleObjectTreeDrawingsRequest = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    publishObjectTreeState()
  }

  window.addEventListener(drawingToolCommandEvent, handleCommand)
  window.addEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
  window.addEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
  window.addEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
  window.addEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
  window.addEventListener('storage', handleStorage)
  chart.subscribeAction(ActionType.OnDataReady, handleDataReady)
  return () => {
    destroyed = true
    clearHoverCursor()
    clearTrendForcedCursor()
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
    hidePendingTrendStartHandle()
    pendingTrendFirstPointPlaced = false
    window.removeEventListener(drawingToolCommandEvent, handleCommand)
    window.removeEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
    window.removeEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
    window.removeEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
    window.removeEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
    window.removeEventListener('storage', handleStorage)
    chart.unsubscribeAction(ActionType.OnDataReady, handleDataReady)
    chartRootDom?.removeEventListener('pointerdown', handleRootPointer, true)
    chartRootDom?.removeEventListener('pointermove', handleRootPointer, true)
    chartRootDom?.removeEventListener('mousemove', handleRootPointer, true)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    paneInteractionCleanups.forEach((cleanup) => cleanup())
  }
}
