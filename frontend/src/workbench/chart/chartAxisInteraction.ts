import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'

type ChartWithDrawPaneAccess = Chart & {
  adjustPaneViewport?: (shouldMeasureHeight?: boolean, shouldMeasureWidth?: boolean, shouldUpdate?: boolean, shouldAdjustYAxis?: boolean, shouldForceAdjustYAxis?: boolean) => void
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      convertToRealValue?: (value: number) => number
      getRange?: () => AxisRange | null
      getScrollZoomEnabled?: () => boolean
      setRange?: (range: AxisRange) => void
      setAutoCalcTickFlag?: (flag: boolean) => void
    }
  } | null
}

type AxisRange = {
  from: number
  to: number
  range: number
  realFrom: number
  realTo: number
  realRange: number
}

export const candlePaneId = 'candle_pane'
export const chartYAxisUnlockPaneIds: string[] = []
export const indicatorYAxisAutoScalePaneIds = ['rsi_pane', 'stoch_pane', 'sqzmom_pane', 'macd_pane', 'dpo_pane', 'vdo_pane', 'tsi_pane', 'vi_pane']
export const allYAxisAutoScalePaneIds = [candlePaneId, ...indicatorYAxisAutoScalePaneIds]
export const chartManualYAxisPaneIds = [...indicatorYAxisAutoScalePaneIds]
export const chartManualYAxisRangeChangeEvent = 'ff:chart-manual-y-axis-range-change'
const manualYAxisDragSpeed = 2.8

export function unlockYAxisManualDrag(chart: Chart, paneIds: string[] = chartYAxisUnlockPaneIds) {
  const chartWithDrawPaneAccess = chart as ChartWithDrawPaneAccess

  paneIds.forEach((paneId) => {
    const yAxis = chartWithDrawPaneAccess.getDrawPaneById?.(paneId)?.getAxisComponent?.()
    yAxis?.setAutoCalcTickFlag?.(false)
  })
}

export function scheduleUnlockYAxisManualDrag(chart: Chart, paneIds?: string[]) {
  window.requestAnimationFrame(() => unlockYAxisManualDrag(chart, paneIds))
}

export function resetIndicatorYAxisAutoScale(chart: Chart, paneIds: string[] = indicatorYAxisAutoScalePaneIds) {
  const chartWithDrawPaneAccess = chart as ChartWithDrawPaneAccess

  paneIds.forEach((paneId) => {
    const yAxis = chartWithDrawPaneAccess.getDrawPaneById?.(paneId)?.getAxisComponent?.()
    yAxis?.setAutoCalcTickFlag?.(true)
  })
  chartWithDrawPaneAccess.adjustPaneViewport?.(false, true, true, true, true)
}

export function scheduleResetIndicatorYAxisAutoScale(chart: Chart, paneIds?: string[]) {
  window.requestAnimationFrame(() => resetIndicatorYAxisAutoScale(chart, paneIds))
}

export function resetYAxisAutoScaleFlags(chart: Chart, paneIds: string[] = allYAxisAutoScalePaneIds) {
  resetIndicatorYAxisAutoScale(chart, paneIds)
}

export function scheduleResetYAxisAutoScaleFlags(chart: Chart, paneIds?: string[]) {
  window.requestAnimationFrame(() => resetYAxisAutoScaleFlags(chart, paneIds))
}

export function installYAxisDragOptimization(chart: Chart) {
  const chartRoot = chart.getDom()
  if (!chartRoot) return () => {}
  const chartWithDrawPaneAccess = chart as ChartWithDrawPaneAccess
  const rootElement = chartRoot.ownerDocument.documentElement
  let activeYAxisDrag: {
    paneId: string
    range: AxisRange
    startPageY: number
  } | null = null

  const finishYAxisDrag = () => {
    activeYAxisDrag = null
    rootElement.removeEventListener('mousemove', dragYAxis, true)
    window.removeEventListener('mouseup', finishYAxisDrag, true)
    window.removeEventListener('blur', finishYAxisDrag, true)
  }

  const dragYAxis = (event: MouseEvent) => {
    if (!activeYAxisDrag) return
    if ((event.buttons & 1) !== 1) {
      finishYAxisDrag()
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    const yAxis = chartWithDrawPaneAccess.getDrawPaneById?.(activeYAxisDrag.paneId)?.getAxisComponent?.()
    if (!yAxis?.setRange || !yAxis.convertToRealValue) return
    const scaledPageY = activeYAxisDrag.startPageY + (event.pageY - activeYAxisDrag.startPageY) * manualYAxisDragSpeed
    const scale = scaledPageY / activeYAxisDrag.startPageY
    if (!Number.isFinite(scale) || scale <= 0) return

    const { from, range, to } = activeYAxisDrag.range
    const newRange = range * scale
    const difRange = (newRange - range) / 2
    const newFrom = from - difRange
    const newTo = to + difRange
    const newRealFrom = yAxis.convertToRealValue(newFrom)
    const newRealTo = yAxis.convertToRealValue(newTo)
    yAxis.setRange({
      from: newFrom,
      to: newTo,
      range: newRange,
      realFrom: newRealFrom,
      realTo: newRealTo,
      realRange: newRealTo - newRealFrom,
    })
    chartWithDrawPaneAccess.adjustPaneViewport?.(false, true, true, true)
    window.dispatchEvent(new Event(chartManualYAxisRangeChangeEvent))
  }

  const unlockHitYAxis = (event: MouseEvent | PointerEvent) => {
    if (event.type !== 'mousedown' || !(event instanceof MouseEvent) || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node)) return

    for (const paneId of chartManualYAxisPaneIds) {
      const yAxisDom = chart.getDom(paneId, DomPosition.YAxis)
      if (yAxisDom?.contains(target)) {
        const yAxis = chartWithDrawPaneAccess.getDrawPaneById?.(paneId)?.getAxisComponent?.()
        if (!yAxis?.getRange || !yAxis.setRange || yAxis.getScrollZoomEnabled?.() === false) return
        const range = yAxis.getRange()
        if (!range || range.range <= 0 || event.pageY <= 0) return
        event.preventDefault()
        event.stopImmediatePropagation()
        unlockYAxisManualDrag(chart, [paneId])
        activeYAxisDrag = { paneId, range: { ...range }, startPageY: event.pageY }
        rootElement.addEventListener('mousemove', dragYAxis, true)
        window.addEventListener('mouseup', finishYAxisDrag, true)
        window.addEventListener('blur', finishYAxisDrag, true)
        return
      }
    }
  }

  chartRoot.addEventListener('mousedown', unlockHitYAxis, true)

  return () => {
    finishYAxisDrag()
    chartRoot.removeEventListener('mousedown', unlockHitYAxis, true)
  }
}
