import type { DrawingTrendLineStatsData } from '../rightDrawer/drawingPersistence'
import type { ScreenPoint } from './chartDrawingTypes'

export type TwoPointDrawingStatsPosition = 'center' | 'left' | 'right'

export type TwoPointDrawingStatsPoint = {
  dataIndex?: number
  timestamp?: number
  value?: number
}

export type TwoPointDrawingStatsOptions = {
  data: DrawingTrendLineStatsData[]
  pointMultiplier?: number
}

const defaultPointMultiplier = 1000

export function resolveTwoPointStatsAnchorPoint(position: TwoPointDrawingStatsPosition, start: ScreenPoint, end: ScreenPoint): ScreenPoint {
  if (position === 'left') return start
  if (position === 'right') return end
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

export function buildTwoPointStatsRows({
  end,
  options,
  points,
  start,
}: {
  end: ScreenPoint
  options: TwoPointDrawingStatsOptions
  points: TwoPointDrawingStatsPoint[]
  start: ScreenPoint
}) {
  const selected = options.data
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
  const pointMultiplier = options.pointMultiplier ?? defaultPointMultiplier

  if (selected.includes('price-range')) {
    const text = formatTwoPointStatsNumber(dPrice, 6)
    if (text != null) row1.push(text)
  }
  if (selected.includes('percent-change') && Number.isFinite(priceA) && priceA !== 0) {
    const text = formatTwoPointStatsNumber((dPrice / priceA) * 100, 2)
    if (text != null) {
      if (row1.length) row1[row1.length - 1] = `${row1[row1.length - 1]} (${text}%)`
      else row1.push(`${text}%`)
    }
  }
  if (selected.includes('point-change')) {
    const text = formatTwoPointStatsInteger(dPrice * pointMultiplier)
    if (text != null) row1.push(text)
  }
  if (row1.length) rows.push(row1.join(', '))

  const row2: string[] = []
  if (selected.includes('bar-range')) {
    const bars = Math.abs(Number(pointB?.dataIndex) - Number(pointA?.dataIndex))
    const text = formatTwoPointStatsInteger(bars)
    if (text != null) row2.push(`${text}\u6839K\u7ebf`)
  }
  if (selected.includes('date-time-range')) {
    const timeA = readTwoPointTimeSeconds(pointA)
    const timeB = readTwoPointTimeSeconds(pointB)
    const text = timeA != null && timeB != null ? formatTwoPointStatsDuration(timeB - timeA) : null
    if (text) {
      if (row2.length) row2[row2.length - 1] = `${row2[row2.length - 1]} (${text})`
      else row2.push(text)
    }
  }
  if (selected.includes('distance')) {
    const text = formatTwoPointStatsInteger(Math.sqrt(dx * dx + dy * dy))
    if (text != null) row2.push(`\u8ddd\u79bb: ${text} px`)
  }
  if (row2.length) rows.push(row2.join(', '))

  if (selected.includes('angle')) {
    const text = formatTwoPointStatsNumber(Math.atan2(-dy, dx) * 180 / Math.PI, 2)
    if (text != null) rows.push(`${text}\u00b0`)
  }
  return rows
}

function formatTwoPointStatsNumber(value: number, digits = 6) {
  if (!Number.isFinite(value)) return null
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function formatTwoPointStatsInteger(value: number) {
  if (!Number.isFinite(value)) return null
  return Math.round(value).toLocaleString('en-US')
}

function formatTwoPointStatsDuration(seconds: number) {
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

function readTwoPointTimeSeconds(point: TwoPointDrawingStatsPoint | undefined) {
  const timestamp = Number(point?.timestamp)
  if (!Number.isFinite(timestamp)) return null
  return timestamp > 100000000000 ? timestamp / 1000 : timestamp
}

