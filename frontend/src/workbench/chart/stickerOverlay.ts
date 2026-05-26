import { DomPosition, registerFigure, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import type { DrawingToolState } from '../rightDrawer/drawingToolCommands'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { createEmojiStickerObjectId } from './chartDrawingObjectIds'
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
  bold: boolean
  color: string
  fontFamily: string
  italic: boolean
  locked: boolean
  manualVisible: boolean
  objectId: string
  size: number
  symbol: string
  textStyle: DrawingTextStyle
}

type StickerPoint = { dataIndex?: number; timestamp?: number; value?: number }

type StickerExtendData = StickerOverlayOptions & {
  selected?: boolean
}

type StickerBounds = {
  centerX: number
  centerY: number
  height: number
  left: number
  size: number
  symbol: string
  top: number
  width: number
}

type StickerResizeState = {
  overlayId: string
  paneId: string
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
        bold?: boolean
        height?: number
        italic?: boolean
        selected?: boolean
        size?: number
        symbol?: string
        fontFamily?: string
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
      const fontFamily = typeof sticker.fontFamily === 'string' && sticker.fontFamily.trim() ? sticker.fontFamily.trim() : 'Arial'
      const fontStyle = sticker.italic === true ? 'italic ' : ''
      const fontWeight = sticker.bold === true ? '700 ' : '400 '
      ctx.save()
      ctx.fillStyle = typeof sticker.color === 'string' && sticker.color ? sticker.color : defaultStickerColor
      ctx.font = `${fontStyle}${fontWeight}${Math.round(size)}px ${quoteFontFamily(fontFamily)}, Tahoma, "Segoe UI Symbol", sans-serif`
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
      bold: extendData?.bold,
      color: extendData?.color,
      fontFamily: extendData?.fontFamily,
      height,
      italic: extendData?.italic,
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
    bold: options?.bold === true,
    color: typeof options?.color === 'string' && options.color ? options.color : defaultStickerColor,
    fontFamily: typeof options?.fontFamily === 'string' && options.fontFamily.trim() ? options.fontFamily.trim() : 'Arial',
    italic: options?.italic === true,
    locked: options?.locked === true,
    manualVisible: options?.manualVisible !== false,
    objectId: typeof options?.objectId === 'string' && options.objectId.trim() ? options.objectId.trim() : createEmojiStickerObjectId(),
    size: normalizeStickerSize(options?.size),
    symbol: typeof options?.symbol === 'string' && options.symbol ? options.symbol : defaultStickerSymbol,
    textStyle: normalizeDrawingTextStyle(options?.textStyle),
  }
}

function quoteFontFamily(fontFamily: string) {
  return fontFamily.includes(' ') ? `"${fontFamily.replace(/"/g, '')}"` : fontFamily
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
  const selectedIds = new Set<string>()
  let armed = false
  let options = normalizeStickerOptions(null)
  let selectedId: string | null = null
  let resizeState: StickerResizeState | null = null
  let suppressNextClick = false

  const publish = (selected = selectedId != null) => {
    onState({
      armed,
      locked: options.locked,
      selected,
      showPriceLabel: false,
      stickerBold: options.bold,
      stickerColor: options.color,
      stickerFontFamily: options.fontFamily,
      stickerItalic: options.italic,
      stickerSize: options.size,
      stickerSymbol: options.symbol,
      objectId: options.objectId,
      textStyle: options.textStyle,
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

  const setOverlaySelected = (id: string, selected: boolean) => {
    const overlay = chart.getOverlayById(id)
    if (!overlay) {
      overlayIds.delete(id)
      selectedIds.delete(id)
      return null
    }
    const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
    chart.overrideOverlay({
      id,
      extendData: { ...((extendData as Record<string, unknown> | undefined) ?? {}), selected },
    })
    return extendData
  }

  const syncActiveOptions = () => {
    if (!selectedId) return
    const overlay = chart.getOverlayById(selectedId)
    if (!overlay) {
      selectedIds.delete(selectedId)
      selectedId = selectedIds.values().next().value ?? null
      syncActiveOptions()
      return
    }
    options = normalizeStickerOptions(overlay.extendData as Partial<StickerExtendData> | undefined)
  }

  const clearSelected = () => {
    selectedIds.forEach((id) => setOverlaySelected(id, false))
    selectedIds.clear()
    selectedId = null
    publish(false)
  }

  const setSelected = (id: string | null, additive = false) => {
    if (!id) {
      clearSelected()
      return
    }
    if (!overlayIds.has(id) || !chart.getOverlayById(id)) {
      overlayIds.delete(id)
      selectedIds.delete(id)
      if (selectedId === id) selectedId = selectedIds.values().next().value ?? null
      publish(selectedId != null)
      return
    }
    if (additive) {
      if (selectedIds.has(id)) {
        setOverlaySelected(id, false)
        selectedIds.delete(id)
        if (selectedId === id) selectedId = selectedIds.values().next().value ?? null
      } else {
        selectedIds.add(id)
        selectedId = id
        setOverlaySelected(id, true)
      }
    } else {
      selectedIds.forEach((selectedOverlayId) => {
        if (selectedOverlayId !== id) setOverlaySelected(selectedOverlayId, false)
      })
      selectedIds.clear()
      selectedIds.add(id)
      selectedId = id
      setOverlaySelected(id, true)
    }
    syncActiveOptions()
    publish(selectedId != null)
  }

  const resolveStickerBounds = (id: string, paneId: string): StickerBounds | null => {
    const overlay = chart.getOverlayById(id)
    if (!overlay) return null
    const point = resolvePointPixel(overlay.points?.[0] ?? {}, paneId)
    if (!point) return null
    const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
    const size = normalizeStickerSize(extendData?.size)
    const symbol = String(extendData?.symbol ?? defaultStickerSymbol)
    const width = Math.max(size, measureStickerSymbol(symbol, size))
    const height = size * 1.15
    return {
      centerX: point.x,
      centerY: point.y,
      height,
      left: point.x - width / 2,
      size,
      symbol,
      top: point.y - height / 2,
      width,
    }
  }

  const createOverlay = (paneId: string, point: StickerPoint, preserveObjectId = false) => {
    options = normalizeStickerOptions({
      ...options,
      objectId: preserveObjectId && options.objectId ? options.objectId : createEmojiStickerObjectId(),
    })
    const created = chart.createOverlay({
      name: stickerOverlayName,
      extendData: {
        ...options,
        selected: true,
      },
      lock: options.locked,
      points: [point],
      styles: {},
      visible: options.manualVisible,
      zLevel: stickerOverlayZLevel,
    }, paneId)
    if (typeof created !== 'string') return null
    overlayIds.add(created)
    setSelected(created)
    return created
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
      const bounds = resolveStickerBounds(id, paneId)
      if (!bounds) continue
      if (
        eventPoint.x >= bounds.left - 5
        && eventPoint.x <= bounds.left + bounds.width + 5
        && eventPoint.y >= bounds.top - 5
        && eventPoint.y <= bounds.top + bounds.height + 5
      ) return id
    }
    return null
  }

  const hitResizeHandle = (event: MouseEvent, paneId: string) => {
    if (!selectedId) return null
    if (options.locked) return null
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return null
    const bounds = resolveStickerBounds(selectedId, paneId)
    if (!bounds) return null
    const rect = paneMain.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const handles = [
      { x: bounds.left - 4, y: bounds.top - 4 },
      { x: bounds.left + bounds.width + 4, y: bounds.top - 4 },
      { x: bounds.left - 4, y: bounds.top + bounds.height + 4 },
      { x: bounds.left + bounds.width + 4, y: bounds.top + bounds.height + 4 },
    ]
    return handles.some((handle) => Math.abs(x - handle.x) <= 8 && Math.abs(y - handle.y) <= 8)
      ? selectedId
      : null
  }

  const resizeSelected = (event: MouseEvent) => {
    if (!resizeState) return
    const paneMain = chart.getDom(resizeState.paneId, DomPosition.Main)
    if (!paneMain) return
    const bounds = resolveStickerBounds(resizeState.overlayId, resizeState.paneId)
    const overlay = chart.getOverlayById(resizeState.overlayId)
    if (!bounds || !overlay) return
    const rect = paneMain.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const widthFactor = Math.max(1, bounds.width / bounds.size)
    const sizeFromX = Math.abs(x - bounds.centerX) * 2 / widthFactor
    const sizeFromY = Math.abs(y - bounds.centerY) * 2 / 1.15
    const nextSize = normalizeStickerSize(Math.max(sizeFromX, sizeFromY))
    const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
    options = normalizeStickerOptions({ ...extendData, size: nextSize })
    chart.overrideOverlay({
      id: resizeState.overlayId,
      extendData: { ...((extendData as Record<string, unknown> | undefined) ?? {}), size: nextSize, selected: true },
    })
    publish(true)
  }

  const finishResize = () => {
    if (!resizeState) return
    resizeState = null
    suppressNextClick = true
    window.removeEventListener('mousemove', resizeSelected, true)
    window.removeEventListener('mouseup', finishResize, true)
  }

  const handleMouseDown = (event: MouseEvent, paneId: string) => {
    if (armed || event.button !== 0) return
    const hitId = hitResizeHandle(event, paneId)
    if (!hitId) return
    event.preventDefault()
    event.stopPropagation()
    resizeState = { overlayId: hitId, paneId }
    window.addEventListener('mousemove', resizeSelected, true)
    window.addEventListener('mouseup', finishResize, true)
  }

  const handleClick = (event: MouseEvent, paneId: string) => {
    if (suppressNextClick) {
      suppressNextClick = false
      event.preventDefault()
      return
    }
    if (armed) {
      const point = resolveEventPoint(event, paneId)
      if (!point) return
      event.preventDefault()
      createOverlay(paneId, point)
      armed = false
      publish(true)
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
      const onMouseDown = (event: MouseEvent) => handleMouseDown(event, paneId)
      paneMain.addEventListener('click', onClick, true)
      paneMain.addEventListener('mousedown', onMouseDown, true)
      const cleanup = () => {
        paneMain.removeEventListener('click', onClick, true)
        paneMain.removeEventListener('mousedown', onMouseDown, true)
      }
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
      selectedIds.clear()
      selectedId = null
      resizeState = null
      armed = false
      window.removeEventListener('mousemove', resizeSelected, true)
      window.removeEventListener('mouseup', finishResize, true)
    },
    deleteSelected: () => {
      const ids = selectedIds.size > 0 ? [...selectedIds] : selectedId ? [selectedId] : []
      if (ids.length === 0) return
      ids.forEach((id) => {
        chart.removeOverlay({ id })
        overlayIds.delete(id)
      })
      selectedIds.clear()
      selectedId = null
      publish(false)
    },
    getOverlayIds: () => overlayIds,
    getSelectedId: () => selectedId,
    getSelectedIds: () => selectedIds,
    persistableOverlays: () => [...overlayIds]
      .map((id) => chart.getOverlayById(id))
      .filter((overlay): overlay is NonNullable<ReturnType<Chart['getOverlayById']>> => Boolean(overlay)),
    restore: (paneId: string, point: StickerPoint, restoredOptions: Partial<StickerOverlayOptions>) => {
      ensureListeners()
      const previous = options
      options = normalizeStickerOptions(restoredOptions)
      const id = createOverlay(paneId, point, true)
      setSelected(null)
      options = previous
      return id
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
    select: (id: string | null, additive = false) => setSelected(id, additive),
    setManualVisible: (id: string, manualVisible: boolean) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      if (!manualVisible) {
        selectedIds.delete(id)
        if (selectedId === id) selectedId = selectedIds.values().next().value ?? null
      }
      chart.overrideOverlay({
        id,
        extendData: { ...((overlay.extendData as Record<string, unknown> | undefined) ?? {}), manualVisible, selected: manualVisible && selectedIds.has(id) },
        visible: manualVisible,
      })
      syncActiveOptions()
      publish(selectedId != null)
    },
    setSelectedLock: (id: string, locked: boolean) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      chart.overrideOverlay({
        id,
        extendData: { ...((overlay.extendData as Record<string, unknown> | undefined) ?? {}), locked },
        lock: locked,
      })
      if (selectedId === id) {
        options = normalizeStickerOptions({ ...(overlay.extendData as Partial<StickerExtendData> | undefined), locked })
        publish(true)
      }
    },
    toggleSelectedLock: () => {
      if (!selectedId) return
      const overlay = chart.getOverlayById(selectedId)
      if (!overlay) return
      const extendData = overlay.extendData as Partial<StickerExtendData> | undefined
      const locked = extendData?.locked !== true
      options = normalizeStickerOptions({ ...extendData, locked })
      chart.overrideOverlay({
        id: selectedId,
        extendData: { ...((extendData as Record<string, unknown> | undefined) ?? {}), locked, selected: true },
        lock: locked,
      })
      publish(true)
    },
  }
}
