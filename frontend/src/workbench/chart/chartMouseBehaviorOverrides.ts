import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import { drawingOverlayNames, horizontalLineOverlayName, rulerOverlayName, trendLineOverlayName } from '../drawing/drawingOverlayModel'

const dragCursorThreshold = 3

type CursorRestore = {
  cursor: string
  element: HTMLElement
  priority: string
}

type InternalChart = Chart & {
  getChartStore?: () => {
    getOverlayStore?: () => {
      getHoverInstanceInfo?: () => {
        figureKey?: string
        instance?: {
          id?: string
          isDrawing?: () => boolean
          name?: string
          points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
        } | null
        paneId?: string
      } | null
    }
  }
}

type OverlayHoverInfo = {
  cursor: string
  paneMain: HTMLElement
} | null

function hasFiniteValue(point: { value?: number } | undefined) {
  return Number.isFinite(Number(point?.value))
}

function resolveOverlayPoints(chart: Chart, instance: { id?: string; points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }> } | null | undefined) {
  if (instance?.id) {
    const overlay = chart.getOverlayById(instance.id) as { points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }> } | null
    if (Array.isArray(overlay?.points)) return overlay.points
  }
  return instance?.points ?? []
}

function collectCursorElements(root: HTMLElement) {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
}

function resolveMainPaneFromEvent(chart: Chart, event: MouseEvent | PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return null

  for (const paneId of knownDrawingPaneIds) {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (paneMain?.contains(target)) return paneMain
  }
  return null
}

function applyCursor(root: HTMLElement, cursor: string) {
  const restore: CursorRestore[] = collectCursorElements(root).map((element) => ({
    cursor: element.style.getPropertyValue('cursor'),
    element,
    priority: element.style.getPropertyPriority('cursor'),
  }))

  const force = () => {
    restore.forEach(({ element }) => {
      element.style.setProperty('cursor', cursor, 'important')
    })
  }

  force()
  return {
    force,
    restore() {
      restore.forEach(({ cursor: previousCursor, element, priority }) => {
        element.style.setProperty('cursor', previousCursor, priority)
      })
    },
  }
}

function resolveOverlayHoverCursor({
  isHorizontalLineHandle,
  isTwoPointEndpointHandle,
}: {
  isHorizontalLineHandle: boolean
  isTwoPointEndpointHandle: boolean
}) {
  if (isHorizontalLineHandle) return 'ns-resize'
  if (isTwoPointEndpointHandle) return 'default'
  return 'pointer'
}

function isCoordinate(value: Partial<{ x: number; y: number }> | Array<Partial<{ x: number; y: number }>>): value is Partial<{ x: number; y: number }> {
  return !Array.isArray(value)
}

function resolvePointPixel(chart: Chart, point: { dataIndex?: number; timestamp?: number; value?: number }, paneId: string) {
  const value = Number(point.value)
  if (!Number.isFinite(value)) return null
  const dataIndex = Number(point.dataIndex)
  const timestamp = Number(point.timestamp)
  const pixel = chart.convertToPixel({
    ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
    value,
  }, { paneId })
  const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
  const x = Number(coordinate?.x)
  const y = Number(coordinate?.y)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function eventHitsTrendLineEndpoint(chart: Chart, paneMain: HTMLElement, paneId: string, points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>, event: MouseEvent | PointerEvent | null) {
  if (!event) return false
  const rect = paneMain.getBoundingClientRect()
  const eventPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  if (!Number.isFinite(eventPoint.x) || !Number.isFinite(eventPoint.y)) return false
  return points.slice(0, 2).some((point) => {
    const pixel = resolvePointPixel(chart, point, paneId)
    return pixel ? Math.hypot(eventPoint.x - pixel.x, eventPoint.y - pixel.y) <= 12 : false
  })
}

function resolveHoveredOverlayInfo(chart: Chart, event: MouseEvent | PointerEvent | null) {
  const hoverInfo = (chart as InternalChart).getChartStore?.().getOverlayStore?.().getHoverInstanceInfo?.()
  const instanceName = hoverInfo?.instance?.name
  const paneId = hoverInfo?.paneId
  if (!instanceName || !paneId || !drawingOverlayNames.has(instanceName)) return null
  if (hoverInfo.instance?.isDrawing?.() === true) return null
  const points = resolveOverlayPoints(chart, hoverInfo.instance)
  if (instanceName === horizontalLineOverlayName && !hasFiniteValue(points[0])) return null
  if (instanceName === trendLineOverlayName && (!hasFiniteValue(points[0]) || !hasFiniteValue(points[1]))) return null
  if (instanceName === rulerOverlayName && (!hasFiniteValue(points[0]) || !hasFiniteValue(points[1]))) return null
  const paneMain = chart.getDom(paneId, DomPosition.Main)
  if (!paneMain) return null

  const isHorizontalLineHandle = instanceName === horizontalLineOverlayName && hoverInfo?.figureKey === 'handle'
  const isTwoPointEndpointHandle = (instanceName === trendLineOverlayName || instanceName === rulerOverlayName) && (
    (typeof hoverInfo?.figureKey === 'string' && hoverInfo.figureKey.startsWith('point_')) ||
    eventHitsTrendLineEndpoint(chart, paneMain, paneId, points, event)
  )
  return {
    cursor: resolveOverlayHoverCursor({ isHorizontalLineHandle, isTwoPointEndpointHandle }),
    paneMain,
  } satisfies OverlayHoverInfo
}

export function installChartMouseBehaviorOverrides(chart: Chart) {
  const chartRoot = chart.getDom()
  if (!chartRoot) return () => {}

  let activeHoverCursor: ReturnType<typeof applyCursor> | null = null
  let activeHoverName = ''
  let activeHoverRoot: HTMLElement | null = null
  let activePressCursor: ReturnType<typeof applyCursor> | null = null
  let hoverTimer = 0
  let lastPointerEvent: MouseEvent | PointerEvent | null = null
  let pendingPanePress: { paneMain: HTMLElement; x: number; y: number } | null = null

  const finishPress = () => {
    activePressCursor?.restore()
    activePressCursor = null
    pendingPanePress = null
    window.removeEventListener('pointerup', finishPress, true)
    window.removeEventListener('pointercancel', finishPress, true)
    window.removeEventListener('blur', finishPress, true)
  }

  const clearHoverCursor = () => {
    activeHoverCursor?.restore()
    activeHoverCursor = null
    activeHoverName = ''
    activeHoverRoot = null
  }

  const updateHoverCursor = () => {
    hoverTimer = 0
    if (activePressCursor) return

    const hoverInfo = resolveHoveredOverlayInfo(chart, lastPointerEvent)
    if (!hoverInfo) {
      clearHoverCursor()
      return
    }

    if (activeHoverRoot === hoverInfo.paneMain && activeHoverName === hoverInfo.cursor) {
      activeHoverCursor?.force()
      return
    }

    clearHoverCursor()
    activeHoverRoot = hoverInfo.paneMain
    activeHoverName = hoverInfo.cursor
    activeHoverCursor = applyCursor(hoverInfo.paneMain, hoverInfo.cursor)
  }

  const scheduleHoverCursorUpdate = (event?: MouseEvent | PointerEvent) => {
    if (event) lastPointerEvent = event
    activeHoverCursor?.force()
    if (hoverTimer !== 0) return
    hoverTimer = window.setTimeout(updateHoverCursor, 0)
  }

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return

    const paneMain = resolveMainPaneFromEvent(chart, event)
    if (!paneMain) return

    clearHoverCursor()
    lastPointerEvent = event
    const hoverInfo = resolveHoveredOverlayInfo(chart, event)
    activePressCursor?.restore()
    if (hoverInfo?.paneMain === paneMain && (hoverInfo.cursor === 'ns-resize' || hoverInfo.cursor === 'default')) {
      activePressCursor = applyCursor(paneMain, hoverInfo.cursor)
    } else if (hoverInfo?.paneMain === paneMain && hoverInfo.cursor === 'pointer') {
      activePressCursor = applyCursor(paneMain, 'pointer')
      pendingPanePress = { paneMain, x: event.clientX, y: event.clientY }
    } else {
      activePressCursor = null
      pendingPanePress = { paneMain, x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointerup', finishPress, true)
    window.addEventListener('pointercancel', finishPress, true)
    window.addEventListener('blur', finishPress, true)
  }

  const handlePointerMove = (event: PointerEvent) => {
    lastPointerEvent = event
    if (pendingPanePress) {
      const distance = Math.hypot(event.clientX - pendingPanePress.x, event.clientY - pendingPanePress.y)
      if (distance >= dragCursorThreshold) {
        activePressCursor?.restore()
        activePressCursor = applyCursor(pendingPanePress.paneMain, 'grabbing')
        pendingPanePress = null
        activePressCursor.force()
      }
      return
    }
    if (activePressCursor) {
      activePressCursor.force()
      return
    }
    scheduleHoverCursorUpdate(event)
  }

  chartRoot.addEventListener('pointerdown', handlePointerDown, true)
  chartRoot.addEventListener('pointermove', handlePointerMove, true)
  chartRoot.addEventListener('mousemove', scheduleHoverCursorUpdate)
  chartRoot.addEventListener('mouseleave', clearHoverCursor)

  return () => {
    if (hoverTimer !== 0) window.clearTimeout(hoverTimer)
    clearHoverCursor()
    finishPress()
    chartRoot.removeEventListener('pointerdown', handlePointerDown, true)
    chartRoot.removeEventListener('pointermove', handlePointerMove, true)
    chartRoot.removeEventListener('mousemove', scheduleHoverCursorUpdate)
    chartRoot.removeEventListener('mouseleave', clearHoverCursor)
  }
}
