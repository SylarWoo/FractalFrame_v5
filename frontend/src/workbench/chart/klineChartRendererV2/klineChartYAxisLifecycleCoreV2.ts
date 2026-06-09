import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { chartManualYAxisRangeChangeEvent } from '../chartAxisInteraction'

const axisDragSpeed = 2.8

export type KLineChartYAxisRangeCoreV2 = {
  from: number
  range: number
  realFrom: number
  realRange: number
  realTo: number
  to: number
}

export type KLineChartYAxisAccessCoreV2 = {
  convertToRealValue?: (value: number) => number
  getAutoCalcTickFlag?: () => boolean
  getRange?: () => Partial<KLineChartYAxisRangeCoreV2> | null
  getScrollZoomEnabled?: () => boolean
  setAutoCalcTickFlag?: (flag: boolean) => void
  setRange?: (range: KLineChartYAxisRangeCoreV2) => void
}

export type KLineChartWithYAxisAccessCoreV2 = Chart & {
  adjustPaneViewport?: (
    shouldMeasureHeight?: boolean,
    shouldMeasureWidth?: boolean,
    shouldUpdate?: boolean,
    shouldAdjustYAxis?: boolean,
    shouldForceAdjustYAxis?: boolean,
  ) => void
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => KLineChartYAxisAccessCoreV2
  } | null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function uniqueKLineChartYAxisPaneIdsV2(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function normalizeKLineChartYAxisRangeV2(value: unknown): KLineChartYAxisRangeCoreV2 | null {
  if (!value || typeof value !== 'object') return null
  const range = value as Partial<KLineChartYAxisRangeCoreV2>
  if (
    !finiteNumber(range.from) ||
    !finiteNumber(range.to) ||
    !finiteNumber(range.range) ||
    !finiteNumber(range.realFrom) ||
    !finiteNumber(range.realTo) ||
    !finiteNumber(range.realRange) ||
    range.range <= 0 ||
    range.realRange <= 0
  ) {
    return null
  }
  return {
    from: range.from,
    range: range.range,
    realFrom: range.realFrom,
    realRange: range.realRange,
    realTo: range.realTo,
    to: range.to,
  }
}

export function readKLineChartYAxisV2(chart: Chart, paneId: string) {
  return (chart as KLineChartWithYAxisAccessCoreV2).getDrawPaneById?.(paneId)?.getAxisComponent?.() ?? null
}

export function setKLineChartYAxisAutoV2(chart: Chart, paneId: string, forceAdjust = true, shouldAdjust = true) {
  readKLineChartYAxisV2(chart, paneId)?.setAutoCalcTickFlag?.(true)
  if (shouldAdjust) {
    ;(chart as KLineChartWithYAxisAccessCoreV2).adjustPaneViewport?.(false, true, true, true, forceAdjust)
  }
}

export function setKLineChartYAxisManualRangeV2(
  chart: Chart,
  paneId: string,
  range: KLineChartYAxisRangeCoreV2,
  forceAdjust = false,
  shouldAdjust = true,
) {
  const yAxis = readKLineChartYAxisV2(chart, paneId)
  if (!yAxis?.setRange) return false
  yAxis.setAutoCalcTickFlag?.(false)
  yAxis.setRange(range)
  if (shouldAdjust) {
    ;(chart as KLineChartWithYAxisAccessCoreV2).adjustPaneViewport?.(false, true, true, true, forceAdjust)
  }
  return true
}

export function installKLineChartYAxisInteractionCoreV2(options: {
  chart: Chart
  onRangeChange?: (paneId: string) => void
  paneIds: () => string[]
}) {
  const root = options.chart.getDom()
  const owner = root?.ownerDocument.documentElement
  if (!root || !owner) return { destroy() {} }

  const chartWithAccess = options.chart as KLineChartWithYAxisAccessCoreV2
  let activeDrag: {
    paneId: string
    range: KLineChartYAxisRangeCoreV2
    startPageY: number
  } | null = null

  const finishDrag = () => {
    const paneId = activeDrag?.paneId
    activeDrag = null
    owner.removeEventListener('mousemove', dragYAxis, true)
    window.removeEventListener('mouseup', finishDrag, true)
    window.removeEventListener('blur', finishDrag, true)
    if (paneId) options.onRangeChange?.(paneId)
  }

  const dragYAxis = (event: MouseEvent) => {
    if (!activeDrag) return
    if ((event.buttons & 1) !== 1) {
      finishDrag()
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()

    const yAxis = readKLineChartYAxisV2(options.chart, activeDrag.paneId)
    if (!yAxis?.setRange || !yAxis.convertToRealValue) return
    const scaledPageY = activeDrag.startPageY + (event.pageY - activeDrag.startPageY) * axisDragSpeed
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
    chartWithAccess.adjustPaneViewport?.(false, true, true, true)
    window.dispatchEvent(new Event(chartManualYAxisRangeChangeEvent))
  }

  const startDrag = (event: MouseEvent) => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node)) return

    for (const paneId of uniqueKLineChartYAxisPaneIdsV2(options.paneIds())) {
      const yAxisDom = options.chart.getDom(paneId, DomPosition.YAxis)
      if (!yAxisDom?.contains(target)) continue
      const yAxis = readKLineChartYAxisV2(options.chart, paneId)
      if (!yAxis?.getRange || !yAxis.setRange || yAxis.getScrollZoomEnabled?.() === false) return
      const range = normalizeKLineChartYAxisRangeV2(yAxis.getRange())
      if (!range || event.pageY <= 0) return
      event.preventDefault()
      event.stopImmediatePropagation()
      yAxis.setAutoCalcTickFlag?.(false)
      activeDrag = { paneId, range, startPageY: event.pageY }
      owner.addEventListener('mousemove', dragYAxis, true)
      window.addEventListener('mouseup', finishDrag, true)
      window.addEventListener('blur', finishDrag, true)
      return
    }
  }

  const handleDoubleClick = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Node)) return
    for (const paneId of uniqueKLineChartYAxisPaneIdsV2(options.paneIds())) {
      const yAxisDom = options.chart.getDom(paneId, DomPosition.YAxis)
      if (!yAxisDom?.contains(target)) continue
      event.preventDefault()
      event.stopImmediatePropagation()
      setKLineChartYAxisAutoV2(options.chart, paneId)
      window.dispatchEvent(new Event(chartManualYAxisRangeChangeEvent))
      options.onRangeChange?.(paneId)
      return
    }
  }

  root.addEventListener('mousedown', startDrag, true)
  root.addEventListener('dblclick', handleDoubleClick, true)

  return {
    destroy() {
      finishDrag()
      root.removeEventListener('mousedown', startDrag, true)
      root.removeEventListener('dblclick', handleDoubleClick, true)
    },
  }
}
