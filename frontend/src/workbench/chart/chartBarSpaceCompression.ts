import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'

export const minCompressedBarSpace = 0.2
const publicMinBarSpace = 1
const publicMaxBarSpace = 50

type InternalTimeScaleStore = {
  _barSpace?: number
  _gapBarSpace?: number
  _lastBarRightSideDiffBarCount?: number
  _calcGapBarSpace?: () => number
  adjustVisibleRange?: () => void
  coordinateToFloatIndex?: (x: number) => number
}

type InternalChart = Chart & {
  adjustPaneViewport?: (
    shouldMeasureHeight?: boolean,
    shouldMeasureWidth?: boolean,
    shouldUpdate?: boolean,
    shouldAdjustYAxis?: boolean,
    shouldForceAdjustYAxis?: boolean,
  ) => void
  getChartStore?: () => {
    getTimeScaleStore?: () => InternalTimeScaleStore
    getTooltipStore?: () => {
      recalculateCrosshair?: (force?: boolean) => void
    }
  }
}

function clampBarSpace(space: number) {
  if (!Number.isFinite(space)) return publicMinBarSpace
  return Math.max(minCompressedBarSpace, Math.min(publicMaxBarSpace, space))
}

function setInternalBarSpace(chart: Chart, space: number, anchorX?: number) {
  const internalChart = chart as InternalChart
  const chartStore = internalChart.getChartStore?.()
  const timeScaleStore = chartStore?.getTimeScaleStore?.()
  if (!timeScaleStore) {
    chart.setBarSpace(Math.max(publicMinBarSpace, space))
    return false
  }

  const prevBarSpace = chart.getBarSpace()
  const nextBarSpace = clampBarSpace(space)
  if (prevBarSpace === nextBarSpace) return true

  const canAnchor = Number.isFinite(anchorX) && typeof timeScaleStore.coordinateToFloatIndex === 'function'
  const prevFloatIndex = canAnchor ? timeScaleStore.coordinateToFloatIndex?.(anchorX as number) : null

  timeScaleStore._barSpace = nextBarSpace
  timeScaleStore._gapBarSpace = timeScaleStore._calcGapBarSpace?.() ?? 1

  if (
    canAnchor &&
    Number.isFinite(prevFloatIndex) &&
    typeof timeScaleStore._lastBarRightSideDiffBarCount === 'number'
  ) {
    const nextFloatIndex = timeScaleStore.coordinateToFloatIndex?.(anchorX as number)
    if (Number.isFinite(nextFloatIndex)) {
      timeScaleStore._lastBarRightSideDiffBarCount += (prevFloatIndex as number) - (nextFloatIndex as number)
    }
  }

  timeScaleStore.adjustVisibleRange?.()
  chartStore?.getTooltipStore?.().recalculateCrosshair?.(true)
  internalChart.adjustPaneViewport?.(false, true, true, true)
  chart.executeAction(ActionType.OnZoom, { scale: nextBarSpace / prevBarSpace })
  return true
}

export function setChartBarSpace(chart: Chart, space: number, anchorX?: number) {
  const nextBarSpace = clampBarSpace(space)
  if (nextBarSpace >= publicMinBarSpace) {
    chart.setBarSpace(nextBarSpace)
    return
  }
  setInternalBarSpace(chart, nextBarSpace, anchorX)
}

function normalizeWheelScale(event: WheelEvent) {
  let deltaY = -(event.deltaY / 100)
  if (deltaY === 0) return 0
  switch (event.deltaMode) {
    case event.DOM_DELTA_PAGE:
      deltaY *= 120
      break
    case event.DOM_DELTA_LINE:
      deltaY *= 32
      break
  }
  return Math.sign(deltaY) * Math.min(1, Math.abs(deltaY))
}

function resolveMainPaneHit(chart: Chart, event: WheelEvent) {
  const target = event.target
  if (!(target instanceof Node)) return null

  for (const paneId of knownDrawingPaneIds) {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (paneMain?.contains(target)) return paneMain
  }
  return null
}

export function installChartBarSpaceCompression(chart: Chart) {
  const chartRoot = chart.getDom()
  if (!chartRoot) return () => {}

  const handleWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

    const paneMain = resolveMainPaneHit(chart, event)
    if (!paneMain) return

    const currentBarSpace = chart.getBarSpace()
    const scale = normalizeWheelScale(event)
    if (scale === 0) return

    const nextBarSpace = currentBarSpace + scale * (currentBarSpace / 10)
    if (currentBarSpace >= publicMinBarSpace && nextBarSpace >= publicMinBarSpace) return

    event.preventDefault()
    event.stopImmediatePropagation()

    const rect = paneMain.getBoundingClientRect()
    setChartBarSpace(chart, nextBarSpace, event.clientX - rect.left)
  }

  chartRoot.addEventListener('wheel', handleWheel, { capture: true, passive: false })

  return () => {
    chartRoot.removeEventListener('wheel', handleWheel, true)
  }
}
