import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { chartManualYAxisRangeChangeEvent } from '../chartAxisInteraction'

const candlePaneId = 'candle_pane'
const dragSpeed = 2.8

type AxisRange = {
  from: number
  to: number
  range: number
  realFrom: number
  realTo: number
  realRange: number
}

type ChartWithYAxisAccess = Chart & {
  adjustPaneViewport?: (
    shouldMeasureHeight?: boolean,
    shouldMeasureWidth?: boolean,
    shouldUpdate?: boolean,
    shouldAdjustYAxis?: boolean,
    shouldForceAdjustYAxis?: boolean,
  ) => void
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      convertToRealValue?: (value: number) => number
      getRange?: () => AxisRange | null
      getScrollZoomEnabled?: () => boolean
      setAutoCalcTickFlag?: (flag: boolean) => void
      setRange?: (range: AxisRange) => void
    }
  } | null
}

function readYAxis(chart: ChartWithYAxisAccess) {
  return chart.getDrawPaneById?.(candlePaneId)?.getAxisComponent?.() ?? null
}

function resetAutoScale(chart: ChartWithYAxisAccess) {
  readYAxis(chart)?.setAutoCalcTickFlag?.(true)
  chart.adjustPaneViewport?.(false, true, true, true, true)
}

export function installKLineChartMainYAxisInteractionV2(
  chart: Chart,
  options: { onRangeChange?: () => void } = {},
) {
  const root = chart.getDom()
  const yAxisDom = chart.getDom(candlePaneId, DomPosition.YAxis)
  if (!root || !yAxisDom) return { destroy() {} }

  const chartWithYAxisAccess = chart as ChartWithYAxisAccess
  const owner = root.ownerDocument.documentElement
  let activeDrag: { range: AxisRange; startPageY: number } | null = null

  const finishDrag = () => {
    activeDrag = null
    owner.removeEventListener('mousemove', drag, true)
    window.removeEventListener('mouseup', finishDrag, true)
    window.removeEventListener('blur', finishDrag, true)
  }

  const drag = (event: MouseEvent) => {
    if (!activeDrag) return
    if ((event.buttons & 1) !== 1) {
      finishDrag()
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()

    const yAxis = readYAxis(chartWithYAxisAccess)
    if (!yAxis?.setRange || !yAxis.convertToRealValue) return
    const scaledPageY = activeDrag.startPageY + (event.pageY - activeDrag.startPageY) * dragSpeed
    const scale = scaledPageY / activeDrag.startPageY
    if (!Number.isFinite(scale) || scale <= 0) return

    const newRange = activeDrag.range.range * scale
    const diffRange = (newRange - activeDrag.range.range) / 2
    const from = activeDrag.range.from - diffRange
    const to = activeDrag.range.to + diffRange
    const realFrom = yAxis.convertToRealValue(from)
    const realTo = yAxis.convertToRealValue(to)
    yAxis.setRange({
      from,
      to,
      range: newRange,
      realFrom,
      realTo,
      realRange: realTo - realFrom,
    })
    chartWithYAxisAccess.adjustPaneViewport?.(false, true, true, true)
    window.dispatchEvent(new Event(chartManualYAxisRangeChangeEvent))
    options.onRangeChange?.()
  }

  const startDrag = (event: MouseEvent) => {
    if (event.button !== 0 || !yAxisDom.contains(event.target as Node)) return
    const yAxis = readYAxis(chartWithYAxisAccess)
    if (!yAxis?.getRange || !yAxis.setRange || yAxis.getScrollZoomEnabled?.() === false) return
    const range = yAxis.getRange()
    if (!range || range.range <= 0 || event.pageY <= 0) return
    event.preventDefault()
    event.stopImmediatePropagation()
    yAxis.setAutoCalcTickFlag?.(false)
    activeDrag = { range: { ...range }, startPageY: event.pageY }
    owner.addEventListener('mousemove', drag, true)
    window.addEventListener('mouseup', finishDrag, true)
    window.addEventListener('blur', finishDrag, true)
  }

  const handleDoubleClick = (event: MouseEvent) => {
    if (!yAxisDom.contains(event.target as Node)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    resetAutoScale(chartWithYAxisAccess)
    window.dispatchEvent(new Event(chartManualYAxisRangeChangeEvent))
    options.onRangeChange?.()
  }

  root.addEventListener('mousedown', startDrag, true)
  yAxisDom.addEventListener('dblclick', handleDoubleClick, true)

  return {
    destroy() {
      finishDrag()
      root.removeEventListener('mousedown', startDrag, true)
      yAxisDom.removeEventListener('dblclick', handleDoubleClick, true)
    },
  }
}
