import { PolygonType } from 'klinecharts'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'
import { colorWithAlpha, dashedValueForStyle, lineTypeForStyle, normalizeLineStyle } from './chartDrawingStyle'
import type { HorizontalLineExtendData, HorizontalLineFigure } from './chartDrawingTypes'
import { formatOverlayPrice, resolveHorizontalLineLabelPrecision } from './drawingPriceLabelFormat'
import { measureCanvasText } from './drawingTextMeasure'
import { horizontalLineTextFigureName } from './chartDrawingFigures'
import { horizontalLineTextLayoutBounds, horizontalLineTextMiddleLineGap, resolveHorizontalLineTextLayout } from './horizontalLineTextLayout'

export const horizontalLineHitSlop = 6

const selectedHandleColor = '#2962ff'
const selectedHandleDistanceFromScale = 102
const selectedHandleSize = 12
const selectedHandleBorderSize = 2
const selectedHandleRadius = 3
const hoverHandleSize = 12
const hoverHandleBorderSize = 1
const lockedHandleSize = 7
const lockedHandleBorderSize = 1
const lockedHandleGap = 2

export function createHorizontalLinePointFigures({
  bounding,
  coordinates,
  overlay,
}: {
  bounding: { width: number }
  coordinates: Array<{ y?: number }>
  overlay: {
    extendData?: unknown
  }
}) {
  const y = Number(coordinates[0]?.y)
  if (!Number.isFinite(y)) return []
  const extendData = overlay.extendData as HorizontalLineExtendData | undefined
  if (extendData?.manualVisible === false || extendData?.periodVisible === false) return []
  const lineStyle = normalizeLineStyle(extendData?.lineStyle)
  const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
  const selected = extendData?.selected === true
  const hovered = extendData?.hovered === true
  const handlePressed = extendData?.handlePressed === true
  const locked = extendData?.locked === true
  const active = selected || hovered
  const handleX = Math.max(0, bounding.width - selectedHandleDistanceFromScale)
  const textLayout = resolveHorizontalLineTextLayout(extendData?.textStyle, y, 0, bounding.width, measureCanvasText)
  const textBounds = textLayout?.alignV === 'middle' ? horizontalLineTextLayoutBounds(textLayout) : null
  const textGap = textBounds ? { left: textBounds.left - horizontalLineTextMiddleLineGap, right: textBounds.right + horizontalLineTextMiddleLineGap } : null
  const figures: HorizontalLineFigure[] = [{
    type: 'rect',
    styles: {
      borderSize: 0,
      color: 'rgba(0,0,0,0.001)',
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
  if (locked && active && !handlePressed) {
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
  } else if (selected && !handlePressed) {
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
      key: 'handle',
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
  } else if (hovered && !handlePressed) {
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
}

export function createHorizontalLineYAxisFigures({
  coordinates,
  overlay,
  precision,
  thousandsSeparator,
}: {
  coordinates: Array<{ y?: number }>
  overlay: {
    extendData?: unknown
    paneId?: string
    points: Array<{ value?: number }>
  }
  precision: { price: number }
  thousandsSeparator: string
}) {
  const extendData = overlay.extendData as HorizontalLineExtendData | undefined
  if (extendData?.manualVisible === false || extendData?.periodVisible === false) return []
  if (extendData?.showPriceLabel === false) return []
  const y = Number(coordinates[0]?.y)
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
}
