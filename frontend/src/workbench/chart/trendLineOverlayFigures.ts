import { PolygonType } from 'klinecharts'
import { normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'
import { resolveTrendStatsAnchorPoint, trendLineHitFigureName, trendLineStatsBoxFigureName, trendLineTextFigureName } from './chartDrawingFigures'
import { colorWithAlpha, dashedValueForStyle, lineTypeForStyle, normalizeLineStyle } from './chartDrawingStyle'
import type { HorizontalLineFigure, ScreenPoint, TrendLineExtendData } from './chartDrawingTypes'
import { isScreenPoint } from './chartDrawingGeometry'
import { formatOverlayPrice, resolveHorizontalLineLabelPrecision } from './drawingPriceLabelFormat'
import { measureCanvasText } from './drawingTextMeasure'
import { horizontalLineHitSlop } from './horizontalLineOverlayFigures'
import { resolveTrendTextLayout, resolveTrendTextLineExclusion, splitTrendLineSegments } from './trendLineTextLayout'
import {
  createTrendArrowFigures,
  createTrendHandleFigure,
  resolveTrendLineEndpoints,
  trendHandleColor,
  trendMiddleHandleLineWidth,
  trendMiddleHandleRadius,
} from './trendLineFigures'

const trendStatsPointMultiplier = 1000
const trendYAxisSelectionWidth = 80

type TrendOverlayLike = {
  extendData?: unknown
  paneId?: string
  points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
  visible?: boolean
}

export function createTrendLinePointFigures({
  bounding,
  coordinates,
  overlay,
}: {
  bounding: { height: number; width: number }
  coordinates: Array<Partial<ScreenPoint>>
  overlay: TrendOverlayLike
}) {
  const start = coordinates[0]
  const end = coordinates[1]
  const extendData = overlay.extendData as TrendLineExtendData | undefined
  const locked = extendData?.locked === true
  const drawing = extendData?.drawing === true
  if (extendData?.manualVisible === false || extendData?.periodVisible === false) return []
  if (!isScreenPoint(start)) return []
  if (!isScreenPoint(end)) return drawing ? [createTrendHandleFigure(start, locked, true, trendHandleColor, 'point_0')] : []

  const lineStyle = normalizeLineStyle(extendData?.lineStyle)
  const trendStyle = normalizeDrawingTrendLineStyle(extendData?.trendLineStyle)
  const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
  const size = Math.max(1, Math.min(Math.round(lineStyle.thickness), 4))
  const endpointPressed = extendData?.endpointPressed === true
  const pressedPointIndex = Number(extendData?.pressedPointIndex)
  const active = !endpointPressed && (extendData?.selected === true || extendData?.hovered === true || extendData?.pressed === true)
  const selected = extendData?.selected === true || extendData?.pressed === true
  const resolved = resolveTrendLineEndpoints(start, end, bounding, trendStyle.extendMode)
  const middleHandleVisible = active && trendStyle.middleVisible
  const lineFigureStyles = {
    color,
    dashedValue: dashedValueForStyle(lineStyle.lineStyle),
    size,
    style: lineTypeForStyle(lineStyle.lineStyle),
  }
  const figures: HorizontalLineFigure[] = [{
    key: 'trend-hit-line',
    type: trendLineHitFigureName,
    attrs: {
      coordinates: [resolved.start, resolved.end],
      hitSlop: horizontalLineHitSlop,
    },
  }]

  const textLayout = resolveTrendTextLayout(extendData?.textStyle, start, end, measureCanvasText)
  const textExclusion = resolveTrendTextLineExclusion(textLayout)
  const exclusions: Array<{ from: ScreenPoint; to: ScreenPoint }> = []
  if (middleHandleVisible) {
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
    const dx = resolved.end.x - resolved.start.x
    const dy = resolved.end.y - resolved.start.y
    const lineLength = Math.hypot(dx, dy)
    const gap = trendMiddleHandleRadius + trendMiddleHandleLineWidth + 1
    if (lineLength > gap * 2) {
      const unitX = dx / lineLength
      const unitY = dy / lineLength
      exclusions.push({
        from: { x: middle.x - unitX * gap, y: middle.y - unitY * gap },
        to: { x: middle.x + unitX * gap, y: middle.y + unitY * gap },
      })
    }
  }
  if (textExclusion) exclusions.push(textExclusion)

  const lineSegments = splitTrendLineSegments(resolved.start, resolved.end, exclusions)
  if (lineSegments.length === 0) {
    figures.push({ type: 'line', attrs: { coordinates: [resolved.start, resolved.end] }, styles: lineFigureStyles })
  } else {
    lineSegments.forEach((segment) => {
      figures.push({ type: 'line', attrs: { coordinates: [segment.start, segment.end] }, styles: lineFigureStyles })
    })
  }
  if (trendStyle.startMarker === 'arrow') figures.push(...createTrendArrowFigures(resolved.start, resolved.end, color, size))
  if (trendStyle.endMarker === 'arrow') figures.push(...createTrendArrowFigures(resolved.end, resolved.start, color, size))
  if (active || endpointPressed || drawing) {
    if (!endpointPressed || pressedPointIndex !== 0) figures.push(createTrendHandleFigure(start, locked, selected, trendHandleColor, 'point_0'))
    if (!drawing && (!endpointPressed || pressedPointIndex !== 1)) figures.push(createTrendHandleFigure(end, locked, selected, trendHandleColor, 'point_1'))
  }
  if (middleHandleVisible) {
    figures.push({
      type: 'circle',
      attrs: { r: trendMiddleHandleRadius, x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      styles: {
        borderColor: color,
        borderSize: trendMiddleHandleLineWidth,
        color: '#ffffff',
        style: PolygonType.StrokeFill,
      },
    })
  }
  if (textLayout) {
    figures.push({
      type: trendLineTextFigureName,
      attrs: { end, start, textStyle: extendData?.textStyle },
      ignoreEvent: true,
    })
  }

  const statsVisible = trendStyle.statsAlwaysVisible || selected || extendData?.pressed === true || endpointPressed || drawing
  if (statsVisible && trendStyle.statsData.length > 0) {
    const rows = buildTrendStatsRows(overlay.points, trendStyle, start, end)
    if (rows.length > 0) {
      figures.push({
        key: 'trend-stats-box',
        type: trendLineStatsBoxFigureName,
        attrs: {
          anchor: resolveTrendStatsAnchorPoint(trendStyle, start, end),
          lineEnd: end,
          lineStart: start,
          right: bounding.width,
          rows,
        },
      })
    }
  }
  if (trendLineStatsBoxFigureName === '' && trendStyle.statsAlwaysVisible && trendStyle.statsData.length > 0) {
    figures.push(...createLegacyTrendStatsTextFigures(overlay.points, trendStyle, start, end, color))
  }
  return figures
}

export function createTrendLineYAxisFigures({
  bounding,
  coordinates,
  overlay,
  precision,
  thousandsSeparator,
}: {
  bounding: { width: number }
  coordinates: Array<{ y?: number }>
  overlay: TrendOverlayLike
  precision: { price: number }
  thousandsSeparator: string
}) {
  const extendData = overlay.extendData as TrendLineExtendData | undefined
  if (overlay.visible === false || extendData?.manualVisible === false || extendData?.periodVisible === false || extendData?.showPriceLabel === false) return []
  const lineStyle = normalizeLineStyle(extendData?.lineStyle)
  const labelPrecision = resolveHorizontalLineLabelPrecision(overlay.paneId, precision.price)
  const selected = extendData?.selected === true || extendData?.pressed === true
  const figures: HorizontalLineFigure[] = []
  const endpointYs = coordinates
    .slice(0, 2)
    .map((coordinate) => coordinate?.y)
    .filter((y): y is number => Number.isFinite(y))
  if (selected && endpointYs.length > 1) {
    const topY = Math.min(...endpointYs)
    const bottomY = Math.max(...endpointYs)
    if (bottomY > topY) {
      figures.push({
        type: 'rect',
        attrs: { height: bottomY - topY, width: Math.min(trendYAxisSelectionWidth, bounding.width), x: 0, y: topY },
        ignoreEvent: true,
        styles: { borderRadius: 0, color: 'rgba(41, 98, 255, 0.25)', style: PolygonType.Fill },
      })
    }
  }
  return figures.concat([0, 1].flatMap((index) => {
    const y = Number(coordinates[index]?.y)
    const value = Number(overlay.points[index]?.value)
    if (!Number.isFinite(y) || !Number.isFinite(value)) return []
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
  }))
}

function formatTrendStatsNumber(value: number, digits = 6) {
  if (!Number.isFinite(value)) return null
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function formatTrendStatsInteger(value: number) {
  if (!Number.isFinite(value)) return null
  return Math.round(value).toLocaleString('en-US')
}

function formatTrendStatsDuration(seconds: number) {
  const total = Math.round(Math.abs(seconds))
  if (!Number.isFinite(total)) return null
  const day = Math.floor(total / 86400)
  const hour = Math.floor((total % 86400) / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const parts: string[] = []
  if (day) parts.push(`${day}\u5929`)
  if (hour) parts.push(`${hour}\u5c0f\u65f6`)
  if (minute || parts.length === 0) parts.push(`${minute}\u5206\u949f`)
  return parts.join(' ')
}

function readTrendPointTimeSeconds(point: { timestamp?: number } | undefined) {
  const timestamp = Number(point?.timestamp)
  if (!Number.isFinite(timestamp)) return null
  return timestamp > 100000000000 ? timestamp / 1000 : timestamp
}

function buildTrendStatsRows(points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>, style: DrawingTrendLineStyle, start: ScreenPoint, end: ScreenPoint) {
  const selected = style.statsData
  if (!selected.length) return []
  const pointA = points[0]
  const pointB = points[1]
  const priceA = Number(pointA?.value)
  const priceB = Number(pointB?.value)
  const dPrice = priceB - priceA
  const dx = end.x - start.x
  const dy = end.y - start.y
  const rows: string[] = []
  const row1: string[] = []

  if (selected.includes('price-range')) {
    const text = formatTrendStatsNumber(dPrice, 6)
    if (text != null) row1.push(text)
  }
  if (selected.includes('percent-change') && Number.isFinite(priceA) && priceA !== 0) {
    const text = formatTrendStatsNumber((dPrice / priceA) * 100, 2)
    if (text != null) {
      if (row1.length) row1[row1.length - 1] = `${row1[row1.length - 1]} (${text}%)`
      else row1.push(`${text}%`)
    }
  }
  if (selected.includes('point-change')) {
    const text = formatTrendStatsInteger(dPrice * trendStatsPointMultiplier)
    if (text != null) row1.push(text)
  }
  if (row1.length) rows.push(row1.join(', '))

  const row2: string[] = []
  if (selected.includes('bar-range')) {
    const bars = Math.abs(Number(pointB?.dataIndex) - Number(pointA?.dataIndex))
    const text = formatTrendStatsInteger(bars)
    if (text != null) row2.push(`${text}\u6839K\u7ebf`)
  }
  if (selected.includes('date-time-range')) {
    const timeA = readTrendPointTimeSeconds(pointA)
    const timeB = readTrendPointTimeSeconds(pointB)
    const text = timeA != null && timeB != null ? formatTrendStatsDuration(timeB - timeA) : null
    if (text) {
      if (row2.length) row2[row2.length - 1] = `${row2[row2.length - 1]} (${text})`
      else row2.push(text)
    }
  }
  if (selected.includes('distance')) {
    const text = formatTrendStatsInteger(Math.sqrt(dx * dx + dy * dy))
    if (text != null) row2.push(`\u8ddd\u79bb: ${text} px`)
  }
  if (row2.length) rows.push(row2.join(', '))

  if (selected.includes('angle')) {
    const text = formatTrendStatsNumber(Math.atan2(-dy, dx) * 180 / Math.PI, 2)
    if (text != null) rows.push(`${text}\u00b0`)
  }
  return rows
}

function createLegacyTrendStatsTextFigures(points: Array<{ dataIndex?: number; value?: number }>, trendStyle: DrawingTrendLineStyle, start: ScreenPoint, end: ScreenPoint, color: string): HorizontalLineFigure[] {
  const valueStart = Number(points[0]?.value)
  const valueEnd = Number(points[1]?.value)
  const valueDelta = Number.isFinite(valueStart) && Number.isFinite(valueEnd) ? valueEnd - valueStart : null
  const statsText = trendStyle.statsData.map((item) => {
    if (item === 'point-change' && valueDelta != null) return valueDelta.toFixed(4)
    if (item === 'percent-change' && valueDelta != null && valueStart !== 0) return `${((valueDelta / valueStart) * 100).toFixed(2)}%`
    if (item === 'price-range' && valueDelta != null) return `${Math.min(valueStart, valueEnd).toFixed(4)} - ${Math.max(valueStart, valueEnd).toFixed(4)}`
    if (item === 'bar-range') return `${Math.abs(Number(points[1]?.dataIndex ?? 0) - Number(points[0]?.dataIndex ?? 0))}`
    if (item === 'angle') return `${Math.round(Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI)}\u00b0`
    return ''
  }).filter(Boolean).join('  ')
  if (!statsText) return []
  const x = trendStyle.statsPosition === 'left'
    ? Math.min(start.x, end.x)
    : trendStyle.statsPosition === 'right'
      ? Math.max(start.x, end.x)
      : (start.x + end.x) / 2
  return [{
    type: 'text',
    attrs: {
      align: trendStyle.statsPosition === 'left' ? 'left' : trendStyle.statsPosition === 'right' ? 'right' : 'center',
      baseline: 'bottom',
      text: statsText,
      x,
      y: Math.min(start.y, end.y) - 8,
    },
    styles: { backgroundColor: 'rgba(255,255,255,0.82)', color, size: 12 },
  }]
}
