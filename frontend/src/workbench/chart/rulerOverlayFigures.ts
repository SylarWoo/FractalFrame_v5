import { PolygonType } from 'klinecharts'
import { formatGlobalPriceDelta } from './globalPricePrecision'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import { rulerCenterTextFigureName, trendLineHitFigureName, trendLineStatsBoxFigureName } from './chartDrawingFigures'
import { colorWithAlpha, dashedValueForStyle, lineTypeForStyle, normalizeLineStyle } from './chartDrawingStyle'
import type { HorizontalLineFigure, RulerExtendData, ScreenPoint } from './chartDrawingTypes'
import { isScreenPoint } from './chartDrawingGeometry'
import { measureCanvasText } from './drawingTextMeasure'
import { resolveDrawingTextBoxMetrics } from './drawingTextBoxCore'
import { createTwoPointYAxisPriceFigures } from './drawingYAxisPriceLabels'
import { createTrendArrowFigures, createTrendHandleFigure, trendHandleColor } from './trendLineFigures'

type RulerOverlayLike = {
  currentStep?: number
  extendData?: unknown
  paneId?: string
  points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
  visible?: boolean
}

type RulerStatsDataRow = NonNullable<RulerExtendData['dataList']>[number]
const rulerCenterTextGap = 4
const rulerCenterTextVerticalGap = 2

export function createRulerPointFigures({
  bounding,
  coordinates,
  overlay,
}: {
  bounding: { height: number; width: number }
  coordinates: Array<Partial<ScreenPoint>>
  overlay: RulerOverlayLike
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

  const lineStyle = normalizeLineStyle(extendData?.lineStyle)
  const rulerStyle = normalizeDrawingRulerStyle(extendData?.rulerStyle)
  const endpointPressed = extendData?.endpointPressed === true
  const pressedPointIndex = Number(extendData?.pressedPointIndex)
  const selected = extendData?.selected === true || extendData?.pressed === true
  const active = selected || endpointPressed || extendData?.hovered === true || drawing
  const color = colorWithAlpha(lineStyle.hex, lineStyle.opacity)
  const lineSize = Math.max(1, Math.min(Math.round(lineStyle.thickness), 4))
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)
  const width = right - left
  const height = bottom - top
  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  const centerLineX = Math.round(midX)
  const centerLineY = Math.round(midY)
  const lineFigureStyles = {
    color,
    dashedValue: dashedValueForStyle(lineStyle.lineStyle),
    size: lineSize,
    style: lineTypeForStyle(lineStyle.lineStyle),
  }
  const centerTextStyle = normalizeDrawingTextStyle({
    ...extendData?.textStyle,
    alignH: 'center',
    alignV: 'middle',
  })
  const centerTextMetrics = centerTextStyle.body.trim()
    ? resolveDrawingTextBoxMetrics({ measure: measureCanvasText, rowsMode: { trimEnd: true }, textStyle: centerTextStyle })
    : null
  const centerTextBox = centerTextMetrics ? {
    height: centerTextMetrics.rows.length * centerTextMetrics.lineHeight,
    width: centerTextMetrics.width,
    x: centerLineX - centerTextMetrics.width / 2,
    y: centerLineY - (centerTextMetrics.rows.length * centerTextMetrics.lineHeight) / 2,
  } : null
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
      key: 'ruler-hit-horizontal',
      type: trendLineHitFigureName,
      attrs: { coordinates: [{ x: left, y: centerLineY }, { x: right, y: centerLineY }], hitSlop: 6 },
    },
    {
      key: 'ruler-hit-vertical',
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
  createRulerLineSegments({ bottom, centerLineX, centerLineY, left, right, textBox: centerTextBox, top }).forEach((segment) => {
    figures.push({ type: 'line', attrs: { coordinates: segment }, ignoreEvent: true, styles: lineFigureStyles })
  })
  if (width > 0 && height > 0) {
    const upward = end.y < start.y
    figures.push(
      ...createTrendArrowFigures(
        upward ? { x: centerLineX, y: top } : { x: centerLineX, y: bottom },
        upward ? { x: centerLineX, y: bottom } : { x: centerLineX, y: top },
        color,
        lineSize,
      ),
      ...createTrendArrowFigures(
        upward ? { x: right, y: centerLineY } : { x: left, y: centerLineY },
        upward ? { x: left, y: centerLineY } : { x: right, y: centerLineY },
        color,
        lineSize,
      ),
    )
  }
  if (active) {
    if (!endpointPressed || pressedPointIndex !== 0) figures.push(createTrendHandleFigure(start, locked, selected, trendHandleColor, 'point_0'))
    if (!drawing && (!endpointPressed || pressedPointIndex !== 1)) figures.push(createTrendHandleFigure(end, locked, selected, trendHandleColor, 'point_1'))
  }

  if (centerTextMetrics && centerTextBox) {
    figures.push({
      key: 'ruler-center-text',
      type: rulerCenterTextFigureName,
      attrs: {
        center: { x: centerLineX, y: centerLineY },
        textStyle: centerTextStyle,
      },
      ignoreEvent: true,
    })
  }

  const statsVisible = rulerStyle.statsAlwaysVisible || selected || drawing || extendData?.hovered === true
  if (rulerStyle.statsData.length > 0 && statsVisible) {
    const rows = buildRulerStatsRows(overlay.points, rulerStyle.statsData, extendData?.dataList)
    if (rows.length > 0) {
      figures.push({
        key: 'ruler-stats-box',
        type: trendLineStatsBoxFigureName,
        attrs: {
          anchor: { x: centerLineX, y: end.y < start.y ? top : bottom },
          backgroundColor: colorWithAlpha(rulerStyle.labelBackground.hex, rulerStyle.labelBackgroundVisible ? rulerStyle.labelBackground.opacity : 0),
          borderRadius: 2,
          font: `${Math.max(8, Math.min(24, Number(rulerStyle.labelFontSize) || 12))}px Arial, Tahoma, sans-serif`,
          lineEnd: end,
          lineStart: start,
          lineHeight: Math.round(Math.max(8, Math.min(24, Number(rulerStyle.labelFontSize) || 12)) * 1.55),
          padX: 8,
          padY: 4,
          placement: end.y < start.y ? 'above' : 'below',
          right: bounding.width,
          rows,
          shadowBlur: 3,
          shadowColor: 'rgba(15, 23, 42, 0.16)',
          shadowOffsetY: 1,
          textAlign: 'center',
          textColor: colorWithAlpha(rulerStyle.labelColor.hex, rulerStyle.labelColor.opacity),
        },
        ignoreEvent: true,
      })
    }
  }
  return figures
}

function createRulerLineSegments({
  bottom,
  centerLineX,
  centerLineY,
  left,
  right,
  textBox,
  top,
}: {
  bottom: number
  centerLineX: number
  centerLineY: number
  left: number
  right: number
  textBox: { height: number; width: number; x: number; y: number } | null
  top: number
}) {
  if (!textBox) {
    return [
      [{ x: left, y: centerLineY }, { x: right, y: centerLineY }],
      [{ x: centerLineX, y: top }, { x: centerLineX, y: bottom }],
    ]
  }
  const textLeft = textBox.x - rulerCenterTextGap
  const textRight = textBox.x + textBox.width + rulerCenterTextGap
  const textTop = textBox.y - rulerCenterTextVerticalGap
  const textBottom = textBox.y + textBox.height + rulerCenterTextVerticalGap
  const segments: Array<[ScreenPoint, ScreenPoint]> = []
  if (textLeft > left) segments.push([{ x: left, y: centerLineY }, { x: Math.min(textLeft, right), y: centerLineY }])
  if (textRight < right) segments.push([{ x: Math.max(textRight, left), y: centerLineY }, { x: right, y: centerLineY }])
  if (textTop > top) segments.push([{ x: centerLineX, y: top }, { x: centerLineX, y: Math.min(textTop, bottom) }])
  if (textBottom < bottom) segments.push([{ x: centerLineX, y: Math.max(textBottom, top) }, { x: centerLineX, y: bottom }])
  return segments.filter((segment) => segment[0].x !== segment[1].x || segment[0].y !== segment[1].y)
}

export function createRulerYAxisFigures({
  bounding,
  coordinates,
  overlay,
  precision,
  thousandsSeparator,
}: {
  bounding: { width: number }
  coordinates: Array<{ y?: number }>
  overlay: RulerOverlayLike
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

function buildRulerStatsRows(
  points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>,
  statsData: string[],
  dataList: RulerExtendData['dataList'],
) {
  const selected = Array.isArray(statsData) ? statsData : []
  if (!selected.length) return []
  const pointA = points[0]
  const pointB = points[1]
  const priceA = Number(pointA?.value)
  const priceB = Number(pointB?.value)
  const dPrice = priceB - priceA
  const rows: string[] = []
  const first: string[] = []

  if (selected.includes('price-range')) {
    const text = formatRulerPriceRange(dPrice, priceA)
    if (text != null) first.push(text)
  }
  if (selected.includes('percent-change') && Number.isFinite(priceA) && priceA !== 0) {
    const text = formatRulerStatsNumber((dPrice / priceA) * 100, 2)
    if (text != null) {
      if (first.length) first[first.length - 1] = `${first[first.length - 1]} (${text}%)`
      else first.push(`${text}%`)
    }
  }
  if (selected.includes('point-change')) {
    const text = formatRulerStatsInteger(dPrice * 1000)
    if (text != null) first.push(text)
  }
  if (first.length) rows.push(first.join(' '))

  const second: string[] = []
  if (selected.includes('bars-range')) {
    const bars = countRulerBars(pointA, pointB, dataList)
    const text = formatRulerStatsInteger(bars)
    if (text != null) second.push(`${text}根K线`)
  }
  if (selected.includes('date-time-range')) {
    const timeA = readRulerStatsTimeSeconds(pointA, dataList)
    const timeB = readRulerStatsTimeSeconds(pointB, dataList)
    const text = timeA != null && timeB != null ? formatRulerStatsDuration(timeB - timeA) : null
    if (text) {
      if (second.length) second[second.length - 1] = `${second[second.length - 1]}, ${text}`
      else second.push(text)
    }
  }
  if (second.length) rows.push(second.join(' '))

  if (selected.includes('volume')) {
    const volume = sumRulerVolume(pointA, pointB, dataList)
    rows.push(`成交量 ${volume == null ? '--' : formatRulerStatsVolume(volume)}`)
  }
  return rows
}

function countRulerBars(
  pointA: { dataIndex?: number } | undefined,
  pointB: { dataIndex?: number } | undefined,
  dataList: RulerExtendData['dataList'],
) {
  const indexA = Number(pointA?.dataIndex)
  const indexB = Number(pointB?.dataIndex)
  if (!Number.isFinite(indexA) || !Number.isFinite(indexB)) return Number.NaN
  const left = Math.max(0, Math.ceil(Math.min(indexA, indexB)))
  const dataRight = Array.isArray(dataList) && dataList.length > 0 ? dataList.length - 1 : Number.POSITIVE_INFINITY
  const right = Math.min(dataRight, Math.floor(Math.max(indexA, indexB)))
  return right >= left ? right - left + 1 : Number.NaN
}

function formatRulerStatsNumber(value: number, digits = 6) {
  if (!Number.isFinite(value)) return null
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function formatRulerPriceRange(value: number, referencePrice: number) {
  if (!Number.isFinite(value)) return null
  const text = formatGlobalPriceDelta(Math.abs(value), referencePrice, '')
  if (!text) return null
  return value < 0 ? `-${text}` : text
}

function formatRulerStatsInteger(value: number) {
  if (!Number.isFinite(value)) return null
  return Math.round(value).toLocaleString('en-US')
}

function formatRulerStatsDuration(seconds: number) {
  const total = Math.round(Math.abs(seconds))
  if (!Number.isFinite(total)) return null
  const day = Math.floor(total / 86400)
  const hour = Math.floor((total % 86400) / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const parts: string[] = []
  if (day) parts.push(`${day}天`)
  if (hour) parts.push(`${hour}小时`)
  if (minute || parts.length === 0) parts.push(`${minute}分钟`)
  return parts.join(' ')
}

function readRulerStatsTimeSeconds(
  point: { dataIndex?: number; timestamp?: number } | undefined,
  dataList: RulerExtendData['dataList'],
) {
  const pointTimestamp = normalizeRulerTimestamp(point?.timestamp)
  if (pointTimestamp != null) return pointTimestamp
  const index = resolveRulerDataIndex(point, dataList)
  const rowTimestamp = index == null || !Array.isArray(dataList) ? null : normalizeRulerTimestamp(dataList[index]?.timestamp)
  return rowTimestamp
}

function readRulerVolumeValue(row: RulerStatsDataRow | undefined) {
  const value = Number(row?.volume)
  if (Number.isFinite(value)) return Math.max(0, value)
  const tickVolume = Number(row?.tick_volume)
  if (Number.isFinite(tickVolume)) return Math.max(0, tickVolume)
  const realVolume = Number(row?.real_volume)
  if (Number.isFinite(realVolume)) return Math.max(0, realVolume)
  return null
}

function normalizeRulerTimestamp(value: unknown) {
  if (value && typeof value === 'object') {
    const row = value as { day?: number; month?: number; year?: number }
    const year = Number(row.year)
    const month = Number(row.month)
    const day = Number(row.day)
    if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
      return Date.UTC(year, month - 1, day) / 1000
    }
  }
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null
  return timestamp > 100000000000 ? timestamp / 1000 : timestamp
}

function resolveRulerDataIndex(
  point: { dataIndex?: number } | undefined,
  dataList: RulerExtendData['dataList'],
) {
  const raw = Number(point?.dataIndex)
  if (!Number.isFinite(raw) || !Array.isArray(dataList) || dataList.length === 0) return null
  return Math.max(0, Math.min(dataList.length - 1, Math.round(raw)))
}

function sumRulerVolume(
  pointA: { dataIndex?: number } | undefined,
  pointB: { dataIndex?: number } | undefined,
  dataList: RulerExtendData['dataList'],
) {
  if (!Array.isArray(dataList) || dataList.length === 0) return null
  const indexA = Number(pointA?.dataIndex)
  const indexB = Number(pointB?.dataIndex)
  if (!Number.isFinite(indexA) || !Number.isFinite(indexB)) return null
  const left = Math.max(0, Math.ceil(Math.min(indexA, indexB)))
  const right = Math.min(dataList.length - 1, Math.floor(Math.max(indexA, indexB)))
  if (right < left) return null
  let total = 0
  let hasVolume = false
  for (let index = left; index <= right; index += 1) {
    const volume = readRulerVolumeValue(dataList[index])
    if (volume == null) continue
    total += volume
    hasVolume = true
  }
  return hasVolume ? total : null
}

function formatRulerStatsVolume(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${formatRulerStatsNumber(value / 1_000_000_000, 2)}B`
  if (abs >= 1_000_000) return `${formatRulerStatsNumber(value / 1_000_000, 2)}M`
  if (abs >= 1_000) return `${formatRulerStatsNumber(value / 1_000, 2)}K`
  return formatRulerStatsInteger(value) ?? '--'
}
