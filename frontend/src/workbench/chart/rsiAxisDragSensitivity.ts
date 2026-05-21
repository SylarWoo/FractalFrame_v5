import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'

const indicatorAxisPaneIds = ['rsi_pane']
const indicatorAxisDragBoost = 1.8

type InternalChart = Chart & {
  adjustPaneViewport?: (shouldMeasureHeight?: boolean, shouldMeasureWidth?: boolean, shouldUpdate?: boolean, shouldAdjustYAxis?: boolean) => void
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      convertToRealValue?: (value: number) => number
      getRange?: () => { from: number; to: number; range: number } | null
      setAutoCalcTickFlag?: (flag: boolean) => void
      setRange?: (range: {
        from: number
        realFrom: number
        realRange: number
        realTo: number
        range: number
        to: number
      }) => void
    }
  } | null
}

let cleanupIndicatorAxisDrag: (() => void) | null = null

export function uninstallIndicatorAxisDragSensitivity() {
  cleanupIndicatorAxisDrag?.()
  cleanupIndicatorAxisDrag = null
}

function installAxisDragForPane(chart: Chart, paneId: string) {
  const cleanupFns: Array<() => void> = []

  const internalChart = chart as InternalChart
  const axisDom = chart.getDom(paneId, DomPosition.YAxis)
  const pane = internalChart.getDrawPaneById?.(paneId)
  const yAxis = pane?.getAxisComponent?.()
  if (!axisDom || !yAxis) return null
  const axisElement = axisDom
  const yAxisComponent = yAxis
  const axisCursorElements = [axisElement, ...Array.from(axisElement.querySelectorAll<HTMLElement>('*'))]
  const previousCursors = new Map<HTMLElement, string>()

  const applyAxisCursor = () => {
    axisCursorElements.forEach((element) => {
      if (!previousCursors.has(element)) previousCursors.set(element, element.style.cursor)
      element.style.cursor = 'ns-resize'
    })
  }

  const restoreAxisCursor = () => {
    axisCursorElements.forEach((element) => {
      element.style.cursor = previousCursors.get(element) ?? ''
    })
    previousCursors.clear()
  }

  applyAxisCursor()

  let drag:
    | {
        from: number
        range: number
        startScaleDistance: number
        to: number
      }
    | null = null

  const finishDrag = () => {
    drag = null
    applyAxisCursor()
    window.removeEventListener('mousemove', handleMouseMove, true)
    window.removeEventListener('mouseup', handleMouseUp, true)
  }

  const applyRange = (from: number, to: number) => {
    const range = to - from
    const realFrom = yAxisComponent.convertToRealValue?.(from) ?? from
    const realTo = yAxisComponent.convertToRealValue?.(to) ?? to
    yAxisComponent.setRange?.({
      from,
      to,
      range,
      realFrom,
      realTo,
      realRange: realTo - realFrom,
    })
    internalChart.adjustPaneViewport?.(false, true, true, true)
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return

    const currentRange = yAxisComponent.getRange?.()
    const height = axisElement.getBoundingClientRect().height
    if (!currentRange || height <= 0) return

    event.preventDefault()
    event.stopImmediatePropagation()

    yAxisComponent.setAutoCalcTickFlag?.(false)
    drag = {
      from: currentRange.from,
      range: currentRange.range,
      startScaleDistance: event.pageY,
      to: currentRange.to,
    }
    applyAxisCursor()
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mouseup', handleMouseUp, true)
  }

  function handleMouseMove(event: MouseEvent) {
    if (!drag) return

    event.preventDefault()
    event.stopImmediatePropagation()

    const nativeScale = event.pageY / drag.startScaleDistance
    if (!Number.isFinite(nativeScale)) return

    const scale = Math.max(0.08, 1 + (nativeScale - 1) * indicatorAxisDragBoost)

    const newRange = drag.range * scale
    const difRange = (newRange - drag.range) / 2
    applyRange(drag.from - difRange, drag.to + difRange)
  }

  function handleMouseUp(event: MouseEvent) {
    if (!drag) return

    event.preventDefault()
    event.stopImmediatePropagation()
    finishDrag()
  }

  function handleDoubleClick(event: MouseEvent) {
    event.preventDefault()
    event.stopImmediatePropagation()
    yAxisComponent.setAutoCalcTickFlag?.(true)
    internalChart.adjustPaneViewport?.(false, true, true, true)
  }

  axisElement.addEventListener('mousedown', handleMouseDown, true)
  axisElement.addEventListener('dblclick', handleDoubleClick, true)
  axisElement.addEventListener('mouseenter', applyAxisCursor, true)
  axisElement.addEventListener('mousemove', applyAxisCursor, true)

  cleanupFns.push(() => {
    finishDrag()
    axisElement.removeEventListener('mousedown', handleMouseDown, true)
    axisElement.removeEventListener('dblclick', handleDoubleClick, true)
    axisElement.removeEventListener('mouseenter', applyAxisCursor, true)
    axisElement.removeEventListener('mousemove', applyAxisCursor, true)
    restoreAxisCursor()
  })

  return () => cleanupFns.forEach((cleanup) => cleanup())
}

export function installIndicatorAxisDragSensitivity(chart: Chart, paneIds: string[] = indicatorAxisPaneIds) {
  uninstallIndicatorAxisDragSensitivity()
  const cleanups = paneIds
    .map((paneId) => installAxisDragForPane(chart, paneId))
    .filter((cleanup): cleanup is () => void => typeof cleanup === 'function')

  cleanupIndicatorAxisDrag = () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}

export const installRsiAxisDragSensitivity = installIndicatorAxisDragSensitivity
export const uninstallRsiAxisDragSensitivity = uninstallIndicatorAxisDragSensitivity
