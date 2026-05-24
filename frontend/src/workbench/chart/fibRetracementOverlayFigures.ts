import { PolygonType, utils } from 'klinecharts'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import { colorWithAlpha, dashedValueForStyle, lineTypeForStyle, normalizeLineStyle } from './chartDrawingStyle'
import type { HorizontalLineFigure, RulerExtendData, ScreenPoint } from './chartDrawingTypes'
import { isScreenPoint } from './chartDrawingGeometry'
import { createTwoPointYAxisPriceFigures } from './drawingYAxisPriceLabels'
import { createTrendHandleFigure, trendHandleColor } from './trendLineFigures'
import { trendLineHitFigureName } from './chartDrawingFigures'
import { formatOverlayPrice, resolveHorizontalLineLabelPrecision } from './drawingPriceLabelFormat'

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
  precision,
  thousandsSeparator,
}: {
  bounding: { height: number; width: number }
  coordinates: Array<Partial<ScreenPoint>>
  overlay: FibRetracementOverlayLike
  precision?: { price?: number }
  thousandsSeparator?: string
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
  const staticRender = extendData?.staticRender === true
  const active = selected || endpointPressed || extendData?.hovered === true || drawing
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)
  const width = right - left
  const height = bottom - top
  const figures: HorizontalLineFigure[] = [
    ...(!active && !staticRender ? [
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
  ]

  const fibLevels = Array.isArray(extendData?.fibLevels) ? extendData.fibLevels : []
  const reverse = extendData?.fibReverse === true
  const resolveLevelRatio = (ratio: number) => reverse ? 1 - ratio : ratio
  const levelEntries = fibLevels
    .map((level) => ({
      level,
      ratio: Number(level?.value),
      yRatio: resolveLevelRatio(Number(level?.value)),
    }))
    .filter((entry) => Number.isFinite(entry.ratio) && entry.level?.enabled !== false)
  if (extendData?.fibBackgroundVisible !== false && width > 0) {
    const backgroundOpacity = typeof extendData?.fibBackgroundOpacity === 'number' && Number.isFinite(extendData.fibBackgroundOpacity)
      ? Math.max(0, Math.min(extendData.fibBackgroundOpacity, 1))
      : 0.25
    const sortedLevels = [...levelEntries].sort((a, b) => b.ratio - a.ratio)
    for (let index = 0; index < sortedLevels.length - 1; index += 1) {
      const upper = sortedLevels[index]
      const lower = sortedLevels[index + 1]
      const upperY = Math.round(start.y + (end.y - start.y) * upper.yRatio)
      const lowerY = Math.round(start.y + (end.y - start.y) * lower.yRatio)
      const bandTop = Math.min(upperY, lowerY)
      const bandHeight = Math.abs(lowerY - upperY)
      if (bandHeight <= 0) continue
      const color = typeof upper.level?.color === 'string' && upper.level.color.trim() ? upper.level.color : '#787b86'
      figures.push({
        key: `fib-band-${String(upper.level?.value ?? upper.ratio)}-${String(lower.level?.value ?? lower.ratio)}`,
        type: 'rect',
        attrs: { height: bandHeight, width, x: left, y: bandTop },
        ignoreEvent: true,
        styles: {
          color: colorWithAlpha(color, backgroundOpacity),
          style: PolygonType.Fill,
        },
      })
    }
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

  if (extendData?.fibTrendLineVisible === true) {
    const trendLineStyle = normalizeLineStyle(extendData.fibTrendLineStyle)
    figures.push({
      key: 'fib-trend-hit-line',
      type: trendLineHitFigureName,
      attrs: { coordinates: [start, end], hitSlop: 8 },
    })
    figures.push({
      key: 'fib-trend-line',
      type: 'line',
      attrs: { coordinates: [start, end] },
      ignoreEvent: true,
      styles: {
        color: colorWithAlpha(trendLineStyle.hex, trendLineStyle.opacity),
        dashedValue: dashedValueForStyle(trendLineStyle.lineStyle),
        size: Math.max(1, Math.min(Math.round(trendLineStyle.thickness), 4)),
        style: lineTypeForStyle(trendLineStyle.lineStyle),
      },
    })
  }

  const priceLabelsVisible = extendData?.fibPriceVisible !== false && width > 0
  const startValue = Number(overlay.points[0]?.value)
  const endValue = Number(overlay.points[1]?.value)
  const labelAlign = extendData?.fibLabelAlign === 'left' || extendData?.fibLabelAlign === 'right' ? extendData.fibLabelAlign : 'center'
  const labelVAlign = extendData?.fibLabelVAlign === 'middle' || extendData?.fibLabelVAlign === 'bottom' ? extendData.fibLabelVAlign : 'top'
  const fontSize = normalizeFibLabelFontSize(extendData?.fibLabelFontSize)
  const pricePrecision = resolveHorizontalLineLabelPrecision(overlay.paneId, Number(precision?.price))
  const canDrawPriceLabels = priceLabelsVisible && Number.isFinite(startValue) && Number.isFinite(endValue)
  const levelTextVisible = extendData?.fibLevelVisible !== false
  const levelDisplay = extendData?.fibLevelDisplay === 'percent' ? 'percent' : 'value'

  const formatLevelPrice = (ratio: number, rawValue: unknown) => {
    const yRatio = resolveLevelRatio(ratio)
    const price = startValue + (endValue - startValue) * yRatio
    const priceText = formatOverlayPrice(price, pricePrecision, thousandsSeparator ?? ',')
    if (!levelTextVisible) return priceText
    return `${formatFibLevelText(ratio, rawValue, levelDisplay)} ${priceText}`
  }

  const createLevelLineFigures = (level: typeof fibLevels[number] | undefined): HorizontalLineFigure[] => {
    const ratio = Number(level?.value)
    if (!Number.isFinite(ratio)) return []
    if (level?.enabled === false) return []
    const horizontalStyle = normalizeLineStyle({
      hex: typeof level?.color === 'string' && level.color.trim() ? level.color : '#787b86',
      lineStyle: extendData?.fibHorizontalLineStyle?.lineStyle ?? 'solid',
      opacity: typeof level?.opacity === 'number' && Number.isFinite(level.opacity) ? level.opacity : 1,
      thickness: extendData?.fibHorizontalLineStyle?.thickness ?? 1,
    })
    const size = Math.max(1, Math.min(Math.round(horizontalStyle.thickness), 4))
    const y = Math.round(start.y + (end.y - start.y) * resolveLevelRatio(ratio))
    const key = String(level?.value ?? ratio)
    const coordinates = [{ x: left, y }, { x: right, y }]
    const lineStyles = {
      color: colorWithAlpha(horizontalStyle.hex, horizontalStyle.opacity),
      dashedValue: dashedValueForStyle(horizontalStyle.lineStyle),
      size,
      smooth: false,
      style: lineTypeForStyle(horizontalStyle.lineStyle),
    }
    figures.push({
      key: `fib-level-${key}-hit`,
      type: trendLineHitFigureName,
      attrs: { coordinates, hitSlop: 6 },
    })
    if (canDrawPriceLabels && labelAlign === 'center' && labelVAlign === 'middle') {
      const text = formatLevelPrice(ratio, level?.value)
      const textWidth = utils.calcTextWidth(text, fontSize, '500', 'Inter, Arial, sans-serif')
      const centerX = left + width / 2
      const gapLeft = Math.max(left, Math.round(centerX - textWidth / 2 - 4))
      const gapRight = Math.min(right, Math.round(centerX + textWidth / 2 + 4))
      const segments: HorizontalLineFigure[] = []
      if (gapLeft - left > 0.5) {
        segments.push({
          key: `fib-level-${key}-line-left`,
          type: 'line',
          attrs: { coordinates: [{ x: left, y }, { x: gapLeft, y }] },
          ignoreEvent: true,
          styles: lineStyles,
        })
      }
      if (right - gapRight > 0.5) {
        segments.push({
          key: `fib-level-${key}-line-right`,
          type: 'line',
          attrs: { coordinates: [{ x: gapRight, y }, { x: right, y }] },
          ignoreEvent: true,
          styles: lineStyles,
        })
      }
      return segments
    }
    return [{
      key: `fib-level-${key}-line`,
      type: 'line',
      attrs: { coordinates },
      ignoreEvent: true,
      styles: lineStyles,
    }]
  }
  const levelLineFigures: HorizontalLineFigure[] = []
  fibLevels.forEach((level) => {
    levelLineFigures.push(...createLevelLineFigures(level))
  })
  figures.push(...levelLineFigures)

  if (extendData?.fibQuarterSplitVisible === true && width > 0) {
    const quarterStyles = Array.isArray(extendData?.fibQuarterLineStyles) ? extendData.fibQuarterLineStyles : []
    ;[1, 2, 3].forEach((partIndex) => {
      const splitRatio = 0.236 * (partIndex / 4)
      const y = Math.round(start.y + (end.y - start.y) * resolveLevelRatio(splitRatio))
      const style = normalizeLineStyle(quarterStyles[partIndex - 1])
      figures.push({
        key: `fib-quarter-split-${partIndex}`,
        type: 'line',
        attrs: { coordinates: [{ x: left, y }, { x: right, y }] },
        ignoreEvent: true,
        styles: {
          color: colorWithAlpha(style.hex, style.opacity),
          dashedValue: dashedValueForStyle(style.lineStyle),
          size: Math.max(1, Math.min(Math.round(style.thickness), 4)),
          smooth: false,
          style: lineTypeForStyle(style.lineStyle),
        },
      })
    })
  }

  if (canDrawPriceLabels) {
      levelEntries.forEach((entry) => {
        const yRatio = resolveLevelRatio(entry.ratio)
        const y = Math.round(start.y + (end.y - start.y) * yRatio)
        const color = typeof entry.level?.color === 'string' && entry.level.color.trim() ? entry.level.color : '#787b86'
        const opacity = typeof entry.level?.opacity === 'number' && Number.isFinite(entry.level.opacity) ? entry.level.opacity : 1
        const x = labelAlign === 'left'
          ? left - 8
          : labelAlign === 'right'
            ? right + 8
            : left + width / 2
        const textAlign = labelAlign === 'left' ? 'right' : labelAlign === 'right' ? 'left' : 'center'
        const baseline = labelVAlign === 'middle' ? 'middle' : labelVAlign === 'bottom' ? 'top' : 'bottom'
        const yOffset = (labelVAlign === 'middle' ? 0 : labelVAlign === 'bottom' ? 4 : -4) + 2
        figures.push({
          key: `fib-price-${String(entry.level?.value ?? entry.ratio)}`,
          type: 'text',
          attrs: {
            align: textAlign,
            baseline,
            text: formatLevelPrice(entry.ratio, entry.level?.value),
            x,
            y: y + yOffset,
          },
          ignoreEvent: true,
          styles: {
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderColor: 'rgba(0, 0, 0, 0)',
            borderSize: 0,
            color: colorWithAlpha(color, opacity),
            family: 'Inter, Arial, sans-serif',
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            paddingTop: 0,
            size: fontSize,
            weight: '500',
          },
        })
      })
  }

  if (active) {
    if (!endpointPressed || pressedPointIndex !== 0) figures.push(createTrendHandleFigure(start, locked, selected, trendHandleColor, 'point_0'))
    if (!drawing && (!endpointPressed || pressedPointIndex !== 1)) figures.push(createTrendHandleFigure(end, locked, selected, trendHandleColor, 'point_1'))
  }

  return figures
}

function normalizeFibLabelFontSize(value: unknown) {
  const size = Number(value)
  return Number.isFinite(size) ? Math.max(10, Math.min(Math.round(size), 20)) : 12
}

function formatFibLevelText(ratio: number, rawValue: unknown, display: string) {
  if (display === 'percent') return `${trimFixed(ratio * 100, 3)}%`
  const raw = typeof rawValue === 'string' ? rawValue.trim() : ''
  return raw || trimFixed(ratio, 3)
}

function trimFixed(value: number, digits: number) {
  return value.toFixed(digits).replace(/\.?0+$/, '')
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
