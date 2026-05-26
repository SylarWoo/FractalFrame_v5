import { DomPosition, registerFigure, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import type { DrawingToolState } from '../rightDrawer/drawingToolCommands'
import type { HorizontalLineFigure, ScreenPoint } from './chartDrawingTypes'

export const stickerOverlayName = 'ffSticker'

const stickerFigureName = 'ffStickerFigure'
const stickerOverlayZLevel = 20
const defaultStickerColor = '#111827'
const defaultStickerSize = 28
const defaultStickerSymbol = '\u25c6'
let stickerOverlayRegistered = false
let stickerFigureRegistered = false

export type StickerOverlayOptions = {
  color: string
  locked: boolean
  size: number
  symbol: string
}

type StickerPoint = { dataIndex?: number; timestamp?: number; value?: number }

type StickerExtendData = StickerOverlayOptions & {
  selected?: boolean
}

export function ensureStickerOverlay() {
  if (stickerOverlayRegistered) return
  stickerOverlayRegistered = true
  ensureStickerFigure()
  registerOverlay({
    name: stickerOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createStickerPointFigures,
    createYAxisFigures: () => [],
  })
}

function ensureStickerFigure() {
  if (stickerFigureRegistered) return
  stickerFigureRegistered = true
  registerFigure({
    name: stickerFigureName,
    checkEventOn: (coordinate: unknown, attrs: unknown) => {
      const point = coordinate as Partial<ScreenPoint>
      const sticker = attrs as { height?: number; width?: number; x?: number; y?: number }
      const x = Number(point.x)
      const y = Number(point.y)
      const left = Number(sticker.x)
      const top = Number(sticker.y)
      const width = Number(sticker.width)
      const height = Number(sticker.height)
      return Number.isFinite(x)
        && Number.isFinite(y)
        && Number.isFinite(left)
        && Number.isFinite(top)
        && Number.isFinite(width)
        && Number.isFinite(height)
        && x >= left
        && x <= left + width
        && y >= top
        && y <= top + height
    },
    draw: (ctx, attrs: unknown) => {
      const sticker = attrs as {
        color?: string
        height?: number
        selected?: boolean
        size?: number
        symbol?: string
        width?: number
        x?: number
        y?: number
      }
      const left = Number(sticker.x)
      const top = Number(sticker.y)
      const width = Number(sticker.width)
      const height = Number(sticker.height)
      const size = normalizeStickerSize(sticker.size)
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) || !Number.isFinite(height)) return
      const symbol = typeof sticker.symbol === 'string' && sticker.symbol ? sticker.symbol : defaultStickerSymbol
      ctx.save()
      ctx.fillStyle = typeof sticker.color === 'string' && sticker.color ? sticker.color : defaultStickerColor
      ctx.font = `700 ${Math.round(size)}px Arial, Tahoma, "Segoe UI Symbol", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(symbol, left + width / 2, top + height / 2)
      if (sticker.selected === true) {
        ctx.strokeStyle = '#2962ff'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(left - 3.5, top - 3.5, width + 7, height + 7)
        ctx.setLineDash([])
        drawResizeHandle(ctx, left - 4, top - 4)
        drawResizeHandle(ctx, left + width + 4, top - 4)
        drawResizeHandle(ctx, left - 4, top + height + 4)
        drawResizeHandle(ctx, left + width + 4, top + height + 4)
      }
      ctx.restore()
    },
  })
}

function drawResizeHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#2962ff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.rect(x - 3, y - 3, 6, 6)
  ctx.fill()
  ctx.stroke()
}

function createStickerPointFigures({
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
  const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
  const size = normalizeStickerSize(extendData?.size)
  const symbol = String(extendData?.symbol ?? defaultStickerSymbol)
  const width = Math.max(size, measureStickerSymbol(symbol, size))
  const height = size * 1.15
  return [{
    attrs: {
      color: extendData?.color,
      height,
      selected: extendData?.selected === true,
      size,
      symbol,
      width,
      x: x - width / 2,
      y: y - height / 2,
    },
    type: stickerFigureName,
  }] satisfies HorizontalLineFigure[]
}

function measureStickerSymbol(symbol: string, size: number) {
  return Math.max(size, symbol.length * size * 0.72)
}

function normalizeStickerSize(value: unknown) {
  const size = Number(value)
  return Number.isFinite(size) ? Math.max(12, Math.min(Math.round(size), 96)) : defaultStickerSize
}

function normalizeStickerOptions(options: Partial<StickerOverlayOptions> | null | undefined): StickerOverlayOptions {
  return {
    color: typeof options?.color === 'string' && options.color ? options.color : defaultStickerColor,
    locked: options?.locked === true,
    size: normalizeStickerSize(options?.size),
    symbol: typeof options?.symbol === 'string' && options.symbol ? options.symbol : defaultStickerSymbol,
  }
}

export function createStickerOverlayController({
  chart,
  fallbackPaneId,
  onState,
}: {
  chart: Chart
  fallbackPaneId: string
  onState: (state: DrawingToolState) => void
}) {
  ensureStickerOverlay()
  const cleanups: Array<() => void> = []
  const registeredPanes = new Map<string, { cleanup: () => void; element: HTMLElement }>()
  const overlayIds = new Set<string>()
  let armed = false
  let options = normalizeStickerOptions(null)
  let selectedId: string | null = null

  const publish = (selected = selectedId != null) => {
    onState({
      armed,
      locked: options.locked,
      selected,
      showPriceLabel: false,
      stickerColor: options.color,
      stickerSize: options.size,
      stickerSymbol: options.symbol,
      tool: 'emojiSticker',
    })
  }

  const resolveEventPoint = (event: MouseEvent, paneId: string): StickerPoint | null => {
    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return null
    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const point = chart.convertFromPixel([{ x, y }], { paneId })
    const coordinate = Array.isArray(point) ? point[0] : point
    const dataIndex = Number(coordinate?.dataIndex)
    const timestamp = Number(coordinate?.timestamp)
    const value = Number(coordinate?.value)
    if (!Number.isFinite(value)) return null
    return {
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      value,
    }
  }

  const resolvePointPixel = (point: StickerPoint, paneId: string): ScreenPoint | null => {
    const pixel = chart.convertToPixel(point, { paneId })
    const coordinate = Array.isArray(pixel) ? pixel[0] : pixel
    const x = Number(coordinate?.x)
    const y = Number(coordinate?.y)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }

  const setSelected = (id: string | null) => {
    if (selectedId && selectedId !== id) {
      const previous = chart.getOverlayById(selectedId)
      if (previous) {
        chart.overrideOverlay({
          id: selectedId,
          extendData: { ...((previous.extendData as Record<string, unknown> | undefined) ?? {}), selected: false },
        })
      }
    }
    selectedId = id
    if (id) {
      const overlay = chart.getOverlayById(id)
      if (overlay) {
        const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
        options = normalizeStickerOptions(extendData)
        chart.overrideOverlay({ id, extendData: { ...((extendData as Record<string, unknown> | undefined) ?? {}), selected: true } })
      }
    }
    publish(id != null)
  }

  const createOverlay = (paneId: string, point: StickerPoint) => {
    const created = chart.createOverlay({
      name: stickerOverlayName,
      extendData: {
        ...options,
        selected: true,
      },
      lock: options.locked,
      points: [point],
      styles: {},
      visible: true,
      zLevel: stickerOverlayZLevel,
    }, paneId)
    if (typeof created !== 'string') return
    overlayIds.add(created)
    setSelected(created)
  }

  const hitTest = (event: MouseEvent, paneId: string) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return null
    const rect = paneMain.getBoundingClientRect()
    const eventPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    for (const id of [...overlayIds].reverse()) {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        overlayIds.delete(id)
        continue
      }
      if ((overlay.paneId || fallbackPaneId) !== paneId) continue
      const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
      const point = resolvePointPixel(overlay.points?.[0] ?? {}, paneId)
      if (!point) continue
      const size = normalizeStickerSize(extendData?.size)
      const symbol = String(extendData?.symbol ?? defaultStickerSymbol)
      const width = Math.max(size, measureStickerSymbol(symbol, size))
      const height = size * 1.15
      if (
        eventPoint.x >= point.x - width / 2 - 5
        && eventPoint.x <= point.x + width / 2 + 5
        && eventPoint.y >= point.y - height / 2 - 5
        && eventPoint.y <= point.y + height / 2 + 5
      ) return id
    }
    return null
  }

  const handleClick = (event: MouseEvent, paneId: string) => {
    if (armed) {
      const point = resolveEventPoint(event, paneId)
      if (!point) return
      event.preventDefault()
      createOverlay(paneId, point)
      return
    }
    const hitId = hitTest(event, paneId)
    if (hitId) {
      event.preventDefault()
      setSelected(hitId)
      return
    }
    setSelected(null)
  }

  const ensureListeners = () => {
    knownDrawingPaneIds.forEach((paneId) => {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) return
      const registered = registeredPanes.get(paneId)
      if (registered?.element === paneMain) return
      registered?.cleanup()
      const onClick = (event: MouseEvent) => handleClick(event, paneId)
      paneMain.addEventListener('click', onClick, true)
      const cleanup = () => paneMain.removeEventListener('click', onClick, true)
      cleanups.push(cleanup)
      registeredPanes.set(paneId, { cleanup, element: paneMain })
    })
  }

  return {
    cleanup: () => {
      cleanups.forEach((remove) => remove())
      cleanups.length = 0
      registeredPanes.clear()
      overlayIds.clear()
      selectedId = null
      armed = false
    },
    deleteSelected: () => {
      if (!selectedId) return
      chart.removeOverlay({ id: selectedId })
      overlayIds.delete(selectedId)
      selectedId = null
      publish(false)
    },
    release: () => {
      armed = false
      publish(selectedId != null)
    },
    start: (nextOptions: Partial<StickerOverlayOptions>) => {
      options = normalizeStickerOptions({ ...options, ...nextOptions })
      armed = true
      ensureListeners()
      publish(selectedId != null)
    },
    updateOptions: (nextOptions: Partial<StickerOverlayOptions>) => {
      options = normalizeStickerOptions({ ...options, ...nextOptions })
      if (selectedId) {
        const overlay = chart.getOverlayById(selectedId)
        if (overlay) {
          chart.overrideOverlay({
            id: selectedId,
            extendData: { ...((overlay.extendData as Record<string, unknown> | undefined) ?? {}), ...options, selected: true },
          })
        }
      }
      publish(selectedId != null)
    },
  }
}
