import { registerFigure, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import type { HorizontalLineFigure, ScreenPoint } from './chartDrawingTypes'

export const chartSymbolMarkerOverlayName = 'ffSymbolMarker'

const chartSymbolMarkerFigureName = 'ffSymbolMarkerFigure'
const defaultSymbolMarkerColor = '#111827'
const defaultSymbolMarkerFontFamily = 'Arial'
const defaultSymbolMarkerSize = 24
const defaultSymbolMarkerSymbol = '\u25c6'
const defaultSymbolMarkerZLevel = 18

let symbolMarkerOverlayRegistered = false
let symbolMarkerFigureRegistered = false

export type ChartSymbolMarkerPoint = {
  dataIndex?: number
  timestamp?: number
  value?: number
}

export type ChartSymbolMarkerInput = {
  bold?: boolean
  color?: string
  fontFamily?: string
  id?: string
  italic?: boolean
  ownerId: string
  paneId?: string
  point: ChartSymbolMarkerPoint
  size?: number
  symbol?: string
  visible?: boolean
  zLevel?: number
}

export type ChartSymbolMarker = Required<Omit<ChartSymbolMarkerInput, 'id' | 'paneId' | 'point' | 'zLevel'>> & {
  id: string
  paneId: string
  point: ChartSymbolMarkerPoint
  zLevel: number
}

type SymbolMarkerExtendData = ChartSymbolMarker & {
  systemMarker: true
}

export type ChartSymbolMarkerController = ReturnType<typeof createChartSymbolMarkerController>

declare global {
  interface Window {
    fractalFrameSymbolMarkers?: ChartSymbolMarkerController
  }
}

export function ensureChartSymbolMarkerOverlay() {
  if (symbolMarkerOverlayRegistered) return
  symbolMarkerOverlayRegistered = true
  ensureChartSymbolMarkerFigure()
  registerOverlay({
    name: chartSymbolMarkerOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createSymbolMarkerPointFigures,
    createYAxisFigures: () => [],
  })
}

function ensureChartSymbolMarkerFigure() {
  if (symbolMarkerFigureRegistered) return
  symbolMarkerFigureRegistered = true
  registerFigure({
    name: chartSymbolMarkerFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: unknown) => {
      const marker = attrs as {
        bold?: boolean
        color?: string
        fontFamily?: string
        height?: number
        italic?: boolean
        size?: number
        symbol?: string
        width?: number
        x?: number
        y?: number
      }
      const left = Number(marker.x)
      const top = Number(marker.y)
      const width = Number(marker.width)
      const height = Number(marker.height)
      const size = normalizeSymbolMarkerSize(marker.size)
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) return
      const symbol = normalizeSymbolMarkerSymbol(marker.symbol)
      const fontFamily = normalizeSymbolMarkerFontFamily(marker.fontFamily)
      const fontStyle = marker.italic === true ? 'italic ' : ''
      const fontWeight = marker.bold === true ? '700 ' : '400 '
      ctx.save()
      ctx.fillStyle = normalizeSymbolMarkerColor(marker.color)
      ctx.font = `${fontStyle}${fontWeight}${Math.round(size)}px ${quoteFontFamily(fontFamily)}, Tahoma, "Segoe UI Symbol", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(symbol, left + width / 2, top + height / 2)
      ctx.restore()
    },
  })
}

function createSymbolMarkerPointFigures({
  coordinates,
  overlay,
}: {
  coordinates: Array<Partial<ScreenPoint>>
  overlay: { extendData?: unknown }
}) {
  const coordinate = coordinates[0]
  const x = Number(coordinate?.x)
  const y = Number(coordinate?.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return []
  const extendData = overlay.extendData as Partial<SymbolMarkerExtendData> | undefined
  const size = normalizeSymbolMarkerSize(extendData?.size)
  const symbol = normalizeSymbolMarkerSymbol(extendData?.symbol)
  const width = Math.max(size, measureSymbolMarker(symbol, size))
  const height = size * 1.15
  return [{
    attrs: {
      bold: extendData?.bold,
      color: extendData?.color,
      fontFamily: extendData?.fontFamily,
      height,
      italic: extendData?.italic,
      size,
      symbol,
      width,
      x: x - width / 2,
      y: y - height / 2,
    },
    ignoreEvent: true,
    type: chartSymbolMarkerFigureName,
  }] satisfies HorizontalLineFigure[]
}

export function createChartSymbolMarkerController({
  chart,
  fallbackPaneId,
}: {
  chart: Chart
  fallbackPaneId: string
}) {
  ensureChartSymbolMarkerOverlay()
  const overlayIdByMarkerId = new Map<string, string>()
  const markerIdsByOwnerId = new Map<string, Set<string>>()

  const upsert = (input: ChartSymbolMarkerInput) => {
    const marker = normalizeSymbolMarkerInput(input, fallbackPaneId)
    const existingOverlayId = overlayIdByMarkerId.get(marker.id)
    if (existingOverlayId && chart.getOverlayById(existingOverlayId)) {
      chart.overrideOverlay({
        id: existingOverlayId,
        extendData: createExtendData(marker),
        lock: true,
        points: [marker.point],
        visible: marker.visible,
        zLevel: marker.zLevel,
      })
      indexMarker(marker)
      return marker.id
    }
    if (existingOverlayId) overlayIdByMarkerId.delete(marker.id)
    const created = chart.createOverlay({
      name: chartSymbolMarkerOverlayName,
      extendData: createExtendData(marker),
      lock: true,
      points: [marker.point],
      styles: {},
      visible: marker.visible,
      zLevel: marker.zLevel,
    }, marker.paneId)
    if (typeof created !== 'string') return null
    overlayIdByMarkerId.set(marker.id, created)
    indexMarker(marker)
    return marker.id
  }

  const remove = (markerId: string) => {
    const overlayId = overlayIdByMarkerId.get(markerId)
    if (overlayId) chart.removeOverlay({ id: overlayId })
    overlayIdByMarkerId.delete(markerId)
    markerIdsByOwnerId.forEach((ids, ownerId) => {
      ids.delete(markerId)
      if (ids.size === 0) markerIdsByOwnerId.delete(ownerId)
    })
  }

  const clearOwner = (ownerId: string) => {
    const markerIds = markerIdsByOwnerId.get(ownerId)
    if (!markerIds) return
    ;[...markerIds].forEach(remove)
    markerIdsByOwnerId.delete(ownerId)
  }

  const setOwnerMarkers = (ownerId: string, markers: Array<Omit<ChartSymbolMarkerInput, 'ownerId'>>) => {
    const nextIds = new Set<string>()
    markers.forEach((marker, index) => {
      const id = normalizeSymbolMarkerId(ownerId, marker.id ?? String(index))
      nextIds.add(id)
      upsert({ ...marker, id, ownerId })
    })
    const existingIds = markerIdsByOwnerId.get(ownerId)
    if (existingIds) {
      ;[...existingIds].forEach((id) => {
        if (!nextIds.has(id)) remove(id)
      })
    }
    markerIdsByOwnerId.set(ownerId, nextIds)
  }

  const clearAll = () => {
    ;[...overlayIdByMarkerId.values()].forEach((overlayId) => chart.removeOverlay({ id: overlayId }))
    overlayIdByMarkerId.clear()
    markerIdsByOwnerId.clear()
  }

  const indexMarker = (marker: ChartSymbolMarker) => {
    const previousOwner = findOwnerByMarkerId(marker.id)
    if (previousOwner && previousOwner !== marker.ownerId) markerIdsByOwnerId.get(previousOwner)?.delete(marker.id)
    const ownerIds = markerIdsByOwnerId.get(marker.ownerId) ?? new Set<string>()
    ownerIds.add(marker.id)
    markerIdsByOwnerId.set(marker.ownerId, ownerIds)
  }

  const findOwnerByMarkerId = (markerId: string) => {
    for (const [ownerId, markerIds] of markerIdsByOwnerId.entries()) {
      if (markerIds.has(markerId)) return ownerId
    }
    return null
  }

  return {
    clearAll,
    clearOwner,
    getOverlayId: (markerId: string) => overlayIdByMarkerId.get(markerId) ?? null,
    getOwnerMarkerIds: (ownerId: string) => [...(markerIdsByOwnerId.get(ownerId) ?? [])],
    remove,
    setOwnerMarkers,
    upsert,
  }
}

function createExtendData(marker: ChartSymbolMarker): SymbolMarkerExtendData {
  return {
    ...marker,
    systemMarker: true,
  }
}

function normalizeSymbolMarkerInput(input: ChartSymbolMarkerInput, fallbackPaneId: string): ChartSymbolMarker {
  const ownerId = normalizeOwnerId(input.ownerId)
  const id = normalizeSymbolMarkerId(ownerId, input.id ?? `${Date.now()}:${Math.random().toString(36).slice(2)}`)
  return {
    bold: input.bold === true,
    color: normalizeSymbolMarkerColor(input.color),
    fontFamily: normalizeSymbolMarkerFontFamily(input.fontFamily),
    id,
    italic: input.italic === true,
    ownerId,
    paneId: typeof input.paneId === 'string' && input.paneId.trim() ? input.paneId.trim() : fallbackPaneId,
    point: input.point,
    size: normalizeSymbolMarkerSize(input.size),
    symbol: normalizeSymbolMarkerSymbol(input.symbol),
    visible: input.visible !== false,
    zLevel: normalizeSymbolMarkerZLevel(input.zLevel),
  }
}

function normalizeOwnerId(ownerId: string) {
  const normalized = ownerId.trim()
  return normalized || 'anonymous'
}

function normalizeSymbolMarkerId(ownerId: string, id: string) {
  const normalized = id.trim()
  return normalized.includes(':') ? normalized : `${ownerId}:${normalized || 'marker'}`
}

function normalizeSymbolMarkerColor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : defaultSymbolMarkerColor
}

function normalizeSymbolMarkerFontFamily(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : defaultSymbolMarkerFontFamily
}

function normalizeSymbolMarkerSize(value: unknown) {
  const size = Number(value)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 128)) : defaultSymbolMarkerSize
}

function normalizeSymbolMarkerSymbol(value: unknown) {
  return typeof value === 'string' && value ? value : defaultSymbolMarkerSymbol
}

function normalizeSymbolMarkerZLevel(value: unknown) {
  const zLevel = Number(value)
  return Number.isFinite(zLevel) ? zLevel : defaultSymbolMarkerZLevel
}

function measureSymbolMarker(symbol: string, size: number) {
  return Math.max(size, symbol.length * size * 0.72)
}

function quoteFontFamily(fontFamily: string) {
  return fontFamily.includes(' ') ? `"${fontFamily.replace(/"/g, '')}"` : fontFamily
}
