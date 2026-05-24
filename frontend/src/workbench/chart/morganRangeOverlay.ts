import { DomPosition, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import { createFibRetracementPointFigures } from './fibRetracementOverlayFigures'
import { readMorganRangeFibExtendData } from './morganRangePreset'
import type { RulerExtendData } from './chartDrawingTypes'

const morganRangeOverlayName = 'ffMorganRange'
const morganRangeZLevel = 9
let morganRangeOverlayRegistered = false

type MorganRangePoint = { dataIndex?: number; timestamp?: number; value?: number }

export type StaticMorganRangeOverlayOptions = {
  futureWidthPx?: number
  paneId?: string
  points: [MorganRangePoint, MorganRangePoint]
  startOffsetPx?: number
  visible?: boolean
}

export function ensureMorganRangeOverlay() {
  if (morganRangeOverlayRegistered) return
  morganRangeOverlayRegistered = true
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

export function createStaticMorganRangeOverlay(chart: Chart, {
  futureWidthPx,
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

  return createFibRetracementPointFigures({
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
}
