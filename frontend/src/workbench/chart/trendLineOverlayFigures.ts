import { PolygonType } from 'klinecharts'
import { normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { trendLineHitFigureName, trendLineStatsBoxFigureName, trendLineTextFigureName } from './chartDrawingFigures'
import { colorWithAlpha, dashedValueForStyle, lineTypeForStyle, normalizeLineStyle } from './chartDrawingStyle'
import type { HorizontalLineFigure, ScreenPoint, TrendLineExtendData } from './chartDrawingTypes'
import { isScreenPoint } from './chartDrawingGeometry'
import { measureCanvasText } from './drawingTextMeasure'
import { createTwoPointYAxisPriceFigures } from './drawingYAxisPriceLabels'
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
import { buildTwoPointStatsRows, resolveTwoPointStatsAnchorPoint } from './twoPointDrawingStats'

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
    const rows = buildTwoPointStatsRows({
      end,
      options: { data: trendStyle.statsData },
      points: overlay.points,
      start,
    })
    if (rows.length > 0) {
      figures.push({
        key: 'trend-stats-box',
        type: trendLineStatsBoxFigureName,
        attrs: {
          anchor: resolveTwoPointStatsAnchorPoint(trendStyle.statsPosition, start, end),
          lineEnd: end,
          lineStart: start,
          right: bounding.width,
          rows,
        },
      })
    }
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
  const selected = extendData?.selected === true || extendData?.pressed === true
  return createTwoPointYAxisPriceFigures({
    bounding,
    coordinates,
    lineStyle: extendData?.lineStyle,
    overlay,
    precision,
    selected,
    thousandsSeparator,
  })
}
