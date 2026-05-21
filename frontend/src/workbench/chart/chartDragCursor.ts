import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'

const dragCursorPaneIds = ['candle_pane', 'rsi_pane']
const dragCursorCleanupKey = '__fractalframeChartDragCursorCleanup'

type CursorRestore = {
  element: HTMLElement
  cursor: string
}

type ChartWithDragCursorCleanup = Chart & {
  [dragCursorCleanupKey]?: () => void
}

function collectCursorElements(root: HTMLElement) {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
}

function applyCursor(elements: HTMLElement[], cursor: string) {
  const restore: CursorRestore[] = []
  elements.forEach((element) => {
    restore.push({ element, cursor: element.style.cursor })
    element.style.cursor = cursor
  })
  return () => {
    restore.forEach(({ element, cursor: previousCursor }) => {
      element.style.cursor = previousCursor
    })
  }
}

export function installChartDragCursor(chart: Chart) {
  const chartWithCleanup = chart as ChartWithDragCursorCleanup
  chartWithCleanup[dragCursorCleanupKey]?.()

  const cleanups: Array<() => void> = []
  let restoreDraggingCursor: (() => void) | null = null

  const finishDragCursor = () => {
    restoreDraggingCursor?.()
    restoreDraggingCursor = null
    document.body.removeAttribute('data-fractalframe-chart-dragging')
    window.removeEventListener('mouseup', finishDragCursor, true)
    window.removeEventListener('blur', finishDragCursor, true)
  }

  dragCursorPaneIds.forEach((paneId) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      restoreDraggingCursor?.()
      restoreDraggingCursor = applyCursor(collectCursorElements(paneMain), 'grabbing')
      document.body.setAttribute('data-fractalframe-chart-dragging', 'true')
      window.addEventListener('mouseup', finishDragCursor, true)
      window.addEventListener('blur', finishDragCursor, true)
    }

    paneMain.addEventListener('mousedown', handleMouseDown, true)
    cleanups.push(() => paneMain.removeEventListener('mousedown', handleMouseDown, true))
  })

  function cleanupInstalled() {
    finishDragCursor()
    cleanups.forEach((cleanup) => cleanup())
    if (chartWithCleanup[dragCursorCleanupKey] === cleanupInstalled) {
      delete chartWithCleanup[dragCursorCleanupKey]
    }
  }

  chartWithCleanup[dragCursorCleanupKey] = cleanupInstalled
  return cleanupInstalled
}

export function uninstallChartDragCursor(chart: Chart) {
  const chartWithCleanup = chart as ChartWithDragCursorCleanup
  chartWithCleanup[dragCursorCleanupKey]?.()
}
