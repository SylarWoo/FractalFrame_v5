import { DomPosition, LineType, PolygonType, registerFigure, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import { createFibRetracementPointFigures } from './fibRetracementOverlayFigures'
import { readMorganRangeFibExtendData } from './morganRangePreset'
import type { HorizontalLineFigure, RulerExtendData, ScreenPoint } from './chartDrawingTypes'

const morganRangeOverlayName = 'ffMorganRange'
const morganRangeZLevel = 9
const morganNoHitLineFigureName = 'ffMorganNoHitLine'
const morganNoHitRectFigureName = 'ffMorganNoHitRect'
let morganRangeOverlayRegistered = false
let morganNoHitFiguresRegistered = false

type MorganRangePoint = { dataIndex?: number; timestamp?: number; value?: number }
type MorganLineAttrs = { coordinates?: Array<Partial<ScreenPoint>> }
type MorganLineStyles = { color?: string; dashedValue?: number[]; size?: number; style?: LineType | string }
type MorganRectAttrs = { height?: number; width?: number; x?: number; y?: number }
type MorganRectStyles = {
  borderColor?: string
  borderDashedValue?: number[]
  borderSize?: number
  borderStyle?: LineType | string
  color?: string | CanvasGradient
  style?: PolygonType | string
}

export type StaticMorganRangeOverlayOptions = {
  extendData?: Partial<RulerExtendData>
  futureWidthPx?: number
  paneId?: string
  points: [MorganRangePoint, MorganRangePoint]
  startOffsetPx?: number
  visible?: boolean
}

export function ensureMorganRangeOverlay() {
  if (morganRangeOverlayRegistered) return
  morganRangeOverlayRegistered = true
  ensureMorganNoHitFigures()
  registerOverlay({
    name: morganRangeOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createMorganRangePointFigures,
    createYAxisFigures: () => [],
  })
}

function ensureMorganNoHitFigures() {
  if (morganNoHitFiguresRegistered) return
  morganNoHitFiguresRegistered = true
  registerFigure<MorganLineAttrs, MorganLineStyles>({
    name: morganNoHitLineFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs, styles) => {
      const start = attrs.coordinates?.[0]
      const end = attrs.coordinates?.[1]
      if (!isMorganScreenPoint(start) || !isMorganScreenPoint(end)) return
      ctx.save()
      ctx.beginPath()
      ctx.strokeStyle = styles.color ?? '#787b86'
      ctx.lineWidth = normalizeCanvasLineWidth(styles.size)
      ctx.setLineDash([])
      if (styles.style === LineType.Dashed && Array.isArray(styles.dashedValue)) {
        ctx.setLineDash(styles.dashedValue)
      }
      const lineWidth = normalizeCanvasLineWidth(styles.size)
      const startPoint = alignMorganLinePoint(start, end, lineWidth)
      const endPoint = alignMorganLinePoint(end, start, lineWidth)
      ctx.lineWidth = lineWidth
      ctx.moveTo(startPoint.x, startPoint.y)
      ctx.lineTo(endPoint.x, endPoint.y)
      ctx.stroke()
      ctx.restore()
    },
  })
  registerFigure<MorganRectAttrs, MorganRectStyles>({
    name: morganNoHitRectFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs, styles) => {
      const x = Number(attrs.x)
      const y = Number(attrs.y)
      const width = Number(attrs.width)
      const height = Number(attrs.height)
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return
      if (width <= 0 || height <= 0) return
      ctx.save()
      if (styles.style === PolygonType.Stroke || styles.style === PolygonType.StrokeFill) {
        ctx.strokeStyle = styles.borderColor ?? '#787b86'
        ctx.lineWidth = normalizeCanvasLineWidth(styles.borderSize)
        ctx.setLineDash([])
        if (styles.borderStyle === LineType.Dashed && Array.isArray(styles.borderDashedValue)) {
          ctx.setLineDash(styles.borderDashedValue)
        }
        ctx.strokeRect(x, y, width, height)
      }
      if (styles.style !== PolygonType.Stroke) {
        ctx.fillStyle = styles.color ?? '#787b86'
        ctx.fillRect(x, y, width, height)
      }
      ctx.restore()
    },
  })
}

export function createStaticMorganRangeOverlay(chart: Chart, {
  futureWidthPx,
  extendData,
  paneId,
  points,
  startOffsetPx,
  visible = true,
}: StaticMorganRangeOverlayOptions) {
  ensureMorganRangeOverlay()
  const createdId = chart.createOverlay({
    name: morganRangeOverlayName,
    extendData: {
      ...readMorganRangeFibExtendData(),
      ...(extendData ?? {}),
      futureWidthPx,
      startOffsetPx,
    },
    lock: true,
    points,
    styles: {},
    visible,
    zLevel: morganRangeZLevel,
  }, paneId)
  return typeof createdId === 'string' ? createdId : null
}

export function createMorganRangeController({
  chart,
  fallbackPaneId,
  onCompleted,
}: {
  chart: Chart
  fallbackPaneId: string
  onCompleted?: () => void
}) {
  const cleanups: Array<() => void> = []
  const registeredPanes = new Map<string, { cleanup: () => void; element: HTMLElement }>()
  let armed = false
  let overlayId: string | null = null
  let startPoint: MorganRangePoint | null = null
  let startPaneId = fallbackPaneId

  const destroyOverlay = () => {
    if (overlayId) chart.removeOverlay({ id: overlayId })
    overlayId = null
    startPoint = null
  }

  const resolveEventPoint = (event: MouseEvent, paneId: string): MorganRangePoint | null => {
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

  const createOrUpdateOverlay = (endPoint: MorganRangePoint) => {
    if (!startPoint) return
    const points = [startPoint, endPoint]
    if (!overlayId) {
      const createdId = chart.createOverlay({
        name: morganRangeOverlayName,
        extendData: readMorganRangeFibExtendData(),
        lock: true,
        points,
        styles: {},
        visible: true,
        zLevel: morganRangeZLevel,
      })
      overlayId = typeof createdId === 'string' ? createdId : null
      return
    }
    chart.overrideOverlay({
      id: overlayId,
      extendData: readMorganRangeFibExtendData(),
      points,
    })
  }

  const handleClick = (event: MouseEvent, paneId: string) => {
    if (!armed) {
      if (overlayId) destroyOverlay()
      return
    }
    const point = resolveEventPoint(event, paneId)
    if (startPoint) {
      if (!point) return
      event.preventDefault()
      createOrUpdateOverlay(point)
      startPoint = null
      armed = false
      onCompleted?.()
      return
    }
    if (overlayId) {
      destroyOverlay()
      return
    }
    if (!point) return
    event.preventDefault()
    startPoint = point
    startPaneId = paneId
    createOrUpdateOverlay(point)
  }

  const handleMouseMove = (event: MouseEvent, paneId: string) => {
    if (!armed || !startPoint || startPaneId !== paneId) return
    const point = resolveEventPoint(event, paneId)
    if (!point) return
    createOrUpdateOverlay(point)
  }

  const ensureListeners = () => {
    knownDrawingPaneIds.forEach((paneId) => {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) return
      const registered = registeredPanes.get(paneId)
      if (registered?.element === paneMain) return
      registered?.cleanup()
      const onClick = (event: MouseEvent) => handleClick(event, paneId)
      const onMove = (event: MouseEvent) => handleMouseMove(event, paneId)
      paneMain.addEventListener('click', onClick, true)
      paneMain.addEventListener('mousemove', onMove)
      const cleanup = () => {
        paneMain.removeEventListener('click', onClick, true)
        paneMain.removeEventListener('mousemove', onMove)
      }
      cleanups.push(cleanup)
      registeredPanes.set(paneId, { cleanup, element: paneMain })
    })
  }

  const cleanup = () => {
    destroyOverlay()
    cleanups.forEach((removeListener) => removeListener())
    cleanups.length = 0
    registeredPanes.clear()
    armed = false
  }

  return {
    cleanup,
    release: () => {
      armed = false
      destroyOverlay()
    },
    start: () => {
      armed = true
      destroyOverlay()
      ensureListeners()
    },
  }
}

function createMorganRangePointFigures(params: Parameters<typeof createFibRetracementPointFigures>[0]) {
  ensureMorganNoHitFigures()
  const extendData = params.overlay.extendData as (RulerExtendData & { futureWidthPx?: number; startOffsetPx?: number }) | undefined
  const futureWidthPx = Number(extendData?.futureWidthPx)
  const startOffsetPx = Number(extendData?.startOffsetPx)
  const coordinates = [...params.coordinates]
  if (Number.isFinite(futureWidthPx) && futureWidthPx > 0 && coordinates[0] && coordinates[1]) {
    const startX = Number(coordinates[0].x) + (Number.isFinite(startOffsetPx) ? startOffsetPx : 0)
    coordinates[0] = {
      ...coordinates[0],
      x: startX,
    }
    coordinates[1] = {
      ...coordinates[1],
      x: startX + futureWidthPx,
    }
  }

  const figures = createFibRetracementPointFigures({
    ...params,
    coordinates,
    overlay: {
      ...params.overlay,
      currentStep: 0,
      extendData: {
        ...readMorganRangeFibExtendData(),
        ...extendData,
        staticRender: true,
      },
      visible: true,
    },
  })
  return makeMorganFiguresNonInteractive(figures)
}

function makeMorganFiguresNonInteractive(figures: HorizontalLineFigure[]) {
  return figures.flatMap((figure) => {
    if (figure.type === 'rect') return [{ ...figure, type: morganNoHitRectFigureName, ignoreEvent: true }]
    if (figure.type === 'line') return [{ ...figure, type: morganNoHitLineFigureName, ignoreEvent: true }]
    return []
  })
}

function isMorganScreenPoint(value: Partial<ScreenPoint> | undefined): value is ScreenPoint {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y)
}

function normalizeCanvasLineWidth(value: unknown) {
  const width = Number(value)
  return Number.isFinite(width) ? Math.max(1, width) : 1
}

function alignMorganStrokePixel(value: number, lineWidth: number) {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function alignMorganLinePoint(point: ScreenPoint, paired: ScreenPoint, lineWidth: number): ScreenPoint {
  const horizontal = Math.abs(point.y - paired.y) < 0.5
  const vertical = Math.abs(point.x - paired.x) < 0.5
  return {
    x: vertical ? alignMorganStrokePixel(point.x, lineWidth) : point.x,
    y: horizontal ? alignMorganStrokePixel(point.y, lineWidth) : point.y,
  }
}
