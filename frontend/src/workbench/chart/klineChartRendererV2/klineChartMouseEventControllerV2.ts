import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../../drawing/drawingPaneModel'
import { chartCursorModeChangedEvent, readChartCursorMode } from '../chartCursorMode'
import { installKLineChartDrawingMouseEventsV2 } from './klineChartDrawingMouseEventsV2'
import { ensureKLineChartInteractionStateV2, kLineChartHorizontalDragEndEventV2 } from './klineChartInteractionStateV2'

const horizontalDragThreshold = 4

type CursorRestore = {
  cursor: string
  element: HTMLElement
  priority: string
}

function collectCursorTargets(chart: Chart, container: HTMLElement) {
  const targets = new Set<HTMLElement>([container])
  knownDrawingPaneIds.forEach((paneId) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (paneMain) targets.add(paneMain)
  })
  return [...targets]
}

export function installKLineChartMouseEventControllerV2(chart: Chart, container: HTMLElement) {
  ensureKLineChartInteractionStateV2()

  let dragStart: { x: number; y: number } | null = null
  let dragCursorActive = false
  let horizontalDragInProgress = false
  let cursorRestore: CursorRestore[] = []
  const drawingMouseEvents = installKLineChartDrawingMouseEventsV2({
    chart,
    isDragActive: () => dragCursorActive || horizontalDragInProgress,
  })

  const setHorizontalDragInProgress = (value: boolean) => {
    horizontalDragInProgress = value
    if (window.__ffKLineChartV2Interaction) {
      window.__ffKLineChartV2Interaction.horizontalDragInProgress = value
    }
  }

  const restoreCursorMode = () => {
    cursorRestore.forEach(({ cursor, element, priority }) => {
      element.style.setProperty('cursor', cursor, priority)
    })
    cursorRestore = []
  }

  const forceCursor = (cursor: string) => {
    collectCursorTargets(chart, container).forEach((element) => {
      element.style.setProperty('cursor', cursor, 'important')
    })
  }

  const applyCursorMode = () => {
    restoreCursorMode()
    const cursor = readChartCursorMode() === 'crosshair' ? 'crosshair' : 'default'
    cursorRestore = collectCursorTargets(chart, container).map((element) => ({
      cursor: element.style.getPropertyValue('cursor'),
      element,
      priority: element.style.getPropertyPriority('cursor'),
    }))
    cursorRestore.forEach(({ element }) => {
      element.style.setProperty('cursor', cursor, 'important')
    })
  }

  const handleMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return
    dragStart = { x: event.clientX, y: event.clientY }
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragStart) return
    const distanceX = Math.abs(event.clientX - dragStart.x)
    const distanceY = Math.abs(event.clientY - dragStart.y)
    if (!dragCursorActive && Math.hypot(distanceX, distanceY) >= horizontalDragThreshold) {
      dragCursorActive = true
      forceCursor('grabbing')
    }
    if (distanceX >= horizontalDragThreshold && distanceX > distanceY) {
      setHorizontalDragInProgress(true)
    }
  }

  const finishMouseDrag = () => {
    const wasDragging = horizontalDragInProgress
    dragStart = null
    dragCursorActive = false
    setHorizontalDragInProgress(false)
    applyCursorMode()
    drawingMouseEvents.refreshHoverCursor()
    if (wasDragging) window.dispatchEvent(new Event(kLineChartHorizontalDragEndEventV2))
  }

  container.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove, true)
  window.addEventListener('mouseup', finishMouseDrag, true)
  window.addEventListener('mouseleave', finishMouseDrag, true)
  window.addEventListener(chartCursorModeChangedEvent, applyCursorMode)
  window.addEventListener('storage', applyCursorMode)
  applyCursorMode()

  return {
    destroy() {
      drawingMouseEvents.destroy()
      restoreCursorMode()
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mouseup', finishMouseDrag, true)
      window.removeEventListener('mouseleave', finishMouseDrag, true)
      window.removeEventListener(chartCursorModeChangedEvent, applyCursorMode)
      window.removeEventListener('storage', applyCursorMode)
      dragStart = null
      dragCursorActive = false
      setHorizontalDragInProgress(false)
    },
    refreshCursorMode: () => {
      applyCursorMode()
      drawingMouseEvents.refreshHoverCursor()
    },
    isHorizontalDragInProgress: () => horizontalDragInProgress,
  }
}
