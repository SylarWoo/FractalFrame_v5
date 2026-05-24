import { PolygonType } from 'klinecharts'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import { colorWithAlpha, dashedValueForStyle } from './chartDrawingStyle'
import type { HorizontalLineFigure, RulerExtendData, ScreenPoint } from './chartDrawingTypes'
import { isScreenPoint } from './chartDrawingGeometry'
import { createTwoPointYAxisPriceFigures } from './drawingYAxisPriceLabels'
import { createTrendHandleFigure, trendHandleColor } from './trendLineFigures'
import { trendLineHitFigureName } from './chartDrawingFigures'

type FibRetracementOverlayLike = {
  currentStep?: number
  extendData?: unknown
  paneId?: string
  points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
  visible?: boolean
}

export function createFibRetracementPointFigures({
  coordinates,
  overlay,
}: {
  bounding: { height: number; width: number }
  coordinates: Array<Partial<ScreenPoint>>
  overlay: FibRetracementOverlayLike
}) {
  const start = coordinates[0]
  const end = coordinates[1]
  const extendData = overlay.extendData as RulerExtendData | undefined
  const locked = extendData?.locked === true
  const drawing = extendData?.drawing === true
  const firstPointPlaced = Number(overlay.currentStep) > 1
  if (extendData?.manualVisible === false || extendData?.periodVisible === false) return []
  if (!isScreenPoint(start)) return []
  if (!isScreenPoint(end)) return drawing && firstPointPlaced ? [createTrendHandleFigure(start, locked, true, trendHandleColor, 'point_0')] : []

  const rulerStyle = normalizeDrawingRulerStyle(extendData?.rulerStyle)
  const endpointPressed = extendData?.endpointPressed === true
  const pressedPointIndex = Number(extendData?.pressedPointIndex)
  const selected = extendData?.selected === true || extendData?.pressed === true
  const active = selected || endpointPressed || extendData?.hovered === true || drawing
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)
  const width = right - left
  const height = bottom - top
  const centerLineX = Math.round((start.x + end.x) / 2)
  const centerLineY = Math.round((start.y + end.y) / 2)
  const figures: HorizontalLineFigure[] = [
    ...(!active ? [
      {
        key: 'point_0',
        type: trendLineHitFigureName,
        attrs: { coordinates: [start, start], hitSlop: 12 },
      },
      {
        key: 'point_1',
        type: trendLineHitFigureName,
        attrs: { coordinates: [end, end], hitSlop: 12 },
      },
    ] : []),
    {
      key: 'fib-hit-horizontal',
      type: trendLineHitFigureName,
      attrs: { coordinates: [{ x: left, y: centerLineY }, { x: right, y: centerLineY }], hitSlop: 6 },
    },
    {
      key: 'fib-hit-vertical',
      type: trendLineHitFigureName,
      attrs: { coordinates: [{ x: centerLineX, y: top }, { x: centerLineX, y: bottom }], hitSlop: 6 },
    },
  ]

  if (rulerStyle.backgroundVisible && width > 0 && height > 0) {
    figures.push({
      type: 'rect',
      attrs: { height, width, x: left, y: top },
      ignoreEvent: true,
      styles: {
        color: colorWithAlpha(rulerStyle.background.hex, rulerStyle.background.opacity),
        style: PolygonType.Fill,
      },
    })
  }
  if (rulerStyle.borderVisible && width > 0 && height > 0) {
    figures.push({
      type: 'rect',
      attrs: { height, width, x: left, y: top },
      ignoreEvent: true,
      styles: {
        borderColor: colorWithAlpha(rulerStyle.borderLineStyle.hex, rulerStyle.borderLineStyle.opacity),
        borderSize: Math.max(1, Math.min(Math.round(rulerStyle.borderLineStyle.thickness), 4)),
        dashedValue: dashedValueForStyle(rulerStyle.borderLineStyle.lineStyle),
        style: PolygonType.Stroke,
      },
    })
  }

  if (active) {
    if (!endpointPressed || pressedPointIndex !== 0) figures.push(createTrendHandleFigure(start, locked, selected, trendHandleColor, 'point_0'))
    if (!drawing && (!endpointPressed || pressedPointIndex !== 1)) figures.push(createTrendHandleFigure(end, locked, selected, trendHandleColor, 'point_1'))
  }

  return figures
}

export function createFibRetracementYAxisFigures({
  bounding,
  coordinates,
  overlay,
  precision,
  thousandsSeparator,
}: {
  bounding: { width: number }
  coordinates: Array<{ y?: number }>
  overlay: FibRetracementOverlayLike
  precision: { price: number }
  thousandsSeparator: string
}) {
  const extendData = overlay.extendData as RulerExtendData | undefined
  if (overlay.visible === false || extendData?.manualVisible === false || extendData?.periodVisible === false || extendData?.showPriceLabel === false) return []
  return createTwoPointYAxisPriceFigures({
    bounding,
    coordinates,
    lineStyle: extendData?.lineStyle,
    overlay,
    precision,
    selected: extendData?.selected === true || extendData?.pressed === true,
    thousandsSeparator,
  })
}
