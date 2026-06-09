import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import type { ChartPageNavigation } from '../chartRuntimeTypes'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { readSettingsBooleanValue, readSettingsSymbolState, settingsSymbolChangedEvent } from '../../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../../settings/chartSettingsSchema'
import {
  isKLineChartHorizontalDragInProgressV2,
  kLineChartHorizontalDragEndEventV2,
} from './klineChartInteractionStateV2'
import {
  kLineChartIndexToXV2,
  readKLineChartVisibleRangeV2,
  resolveRealtimeBoundaryIndex,
  resolveRealtimeBoundaryX,
} from './klineChartRealtimeBoundaryV2'
import {
  createKLineChartRealtimePageLabelsV2,
  updateKLineChartRealtimePageLabelsV2,
} from './klineChartRealtimePageLabelsV2'
import { createChartRafSchedulerV2 } from './chartRafSchedulerV2'
import './klineChartRealtimePaneV2.css'

export { resolveRealtimeBoundaryIndex } from './klineChartRealtimeBoundaryV2'

const candlePaneId = 'candle_pane'

type SettingsLineSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

type RealtimeSeparatorStyle = {
  color: string
  lineStyle: string
  thickness: number
  visible: boolean
}

function resolveSwatchColor(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as SettingsLineSwatchValue
  const hex = typeof swatch.hex === 'string' ? swatch.hex : fallback
  const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity)
    ? Math.max(0, Math.min(swatch.opacity, 1))
    : 1
  if (opacity >= 0.999) return hex
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function resolveLineStyle(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsLineSwatchValue : null
  if (swatch?.lineStyle === 'dashed') return 'dashed'
  if (swatch?.lineStyle === 'dotted') return 'dotted'
  return 'solid'
}

function resolveLineThickness(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsLineSwatchValue : null
  const thickness = typeof swatch?.thickness === 'number' && Number.isFinite(swatch.thickness) ? swatch.thickness : 1
  return Math.max(1, Math.min(Math.round(thickness), 4))
}

function readRealtimeWindowSeparatorStyle(): RealtimeSeparatorStyle {
  const visible = readSettingsBooleanValue(
    chartSettingKeys.realtimeWindowSeparatorVisible,
    chartSettingDefaults.realtimeWindowSeparatorVisible,
  )
  const swatch = readSettingsSymbolState()['events.realtimeWindowSeparator.color']
  return {
    color: resolveSwatchColor(swatch, '#4984d6'),
    lineStyle: resolveLineStyle(swatch),
    thickness: resolveLineThickness(swatch),
    visible,
  }
}

function updateMainOverlay(root: HTMLElement, boundary: HTMLElement, boundaryX: number | null, separator: RealtimeSeparatorStyle) {
  root.style.display = 'block'
  if (boundaryX == null || !separator.visible) {
    boundary.style.display = 'none'
    return
  }
  boundary.style.display = 'block'
  boundary.style.left = `${boundaryX}px`
  boundary.style.borderLeftColor = separator.color
  boundary.style.borderLeftStyle = separator.lineStyle
  boundary.style.borderLeftWidth = `${separator.thickness}px`
}

export function resolveRealtimeFutureAxisGeometry() {
  return null
}

export function installKLineChartRealtimePaneV2(
  chart: Chart,
  container: HTMLElement,
  initialFrame: KLineChartRenderFrameV2,
  initialPageNavigation?: ChartPageNavigation | null,
) {
  let frame = initialFrame
  let pageNavigation = initialPageNavigation ?? null
  let destroyed = false
  let observedMainDom: HTMLElement | null = null
  let separatorStyle = readRealtimeWindowSeparatorStyle()
  let cachedMainGeometry: { height: number; left: number; top: number; width: number } | null = null
  let renderMode: 'full' | 'boundary-only' = 'full'
  const rafScheduler = createChartRafSchedulerV2()
  const mainPaneResizeObserver = new ResizeObserver(() => {
    scheduleRender()
  })

  const mainRoot = document.createElement('div')
  mainRoot.className = 'ff-kline-chart-realtime-pane-v2'
  const boundaryNode = document.createElement('div')
  boundaryNode.className = 'ff-kline-chart-realtime-pane-v2__boundary'
  const labels = createKLineChartRealtimePageLabelsV2()
  mainRoot.append(boundaryNode, labels.root)
  container.appendChild(mainRoot)

  function hideOverlay() {
    updateMainOverlay(mainRoot, boundaryNode, null, separatorStyle)
    updateKLineChartRealtimePageLabelsV2(labels, {
      boundaryRawX: 0,
      boundaryX: null,
      navigation: null,
      realtimeVisible: false,
      width: 0,
    })
  }

  function render() {
    if (destroyed) return
    const mode = renderMode
    renderMode = 'full'
    const mainDom = chart.getDom(candlePaneId, DomPosition.Main)
    if (mainDom !== observedMainDom) {
      mainPaneResizeObserver.disconnect()
      observedMainDom = mainDom ?? null
      if (observedMainDom) mainPaneResizeObserver.observe(observedMainDom)
    }
    if (!mainDom) {
      hideOverlay()
      return
    }
    let geometry = cachedMainGeometry
    if (mode === 'full' || !geometry) {
      const containerRect = container.getBoundingClientRect()
      const paneRect = mainDom.getBoundingClientRect()
      geometry = {
        height: paneRect.height,
        left: paneRect.left - containerRect.left,
        top: paneRect.top - containerRect.top,
        width: paneRect.width,
      }
      cachedMainGeometry = geometry
      mainRoot.style.left = `${Math.round(geometry.left)}px`
      mainRoot.style.top = `${Math.round(geometry.top)}px`
      mainRoot.style.width = `${Math.round(geometry.width)}px`
      mainRoot.style.height = `${Math.round(geometry.height)}px`
    }
    const visibleRange = readKLineChartVisibleRangeV2(chart)
    if (!visibleRange) {
      hideOverlay()
      return
    }

    const realtime = frame.segments.realtime
    const realtimeVisible = Boolean(realtime)
    const boundaryIndex = resolveRealtimeBoundaryIndex(frame, pageNavigation)
    const boundaryRawX = boundaryIndex != null
      ? kLineChartIndexToXV2(boundaryIndex, visibleRange.realFrom, visibleRange.realTo, geometry.width)
      : geometry.width + 1
    const boundaryX = realtimeVisible
      ? resolveRealtimeBoundaryX({
        frame,
        mainRect: { width: geometry.width },
        navigation: pageNavigation,
        visibleRange,
      })
      : null
    updateMainOverlay(mainRoot, boundaryNode, boundaryX, separatorStyle)
    if (mode === 'boundary-only') return
    updateKLineChartRealtimePageLabelsV2(labels, {
      boundaryRawX,
      boundaryX,
      navigation: pageNavigation,
      realtimeVisible,
      realtimeActualStart: realtime?.timeFrom ?? null,
      width: geometry.width,
    })
  }

  function scheduleRender(mode: 'full' | 'boundary-only' = 'full') {
    if (destroyed) return
    if (isKLineChartHorizontalDragInProgressV2() && mode === 'full') {
      mode = 'boundary-only'
    }
    if (mode === 'full') renderMode = 'full'
    if (mode === 'boundary-only' && renderMode !== 'full') renderMode = 'boundary-only'
    if (destroyed) return
    rafScheduler.schedule('realtime-pane-render', render, {
      priority: mode === 'boundary-only' ? 'overlay' : 'critical',
      replaceLatest: mode === 'full',
    })
  }

  const handleChartChange = () => scheduleRender()
  const handleHorizontalRangeChange = () => scheduleRender('boundary-only')
  const handlePaneDrag = () => scheduleRender('boundary-only')
  const handleSettingsChange = () => {
    separatorStyle = readRealtimeWindowSeparatorStyle()
    scheduleRender()
  }
  chart.subscribeAction(ActionType.OnDataReady, handleChartChange)
  chart.subscribeAction(ActionType.OnScroll, handleHorizontalRangeChange)
  chart.subscribeAction(ActionType.OnVisibleRangeChange, handleHorizontalRangeChange)
  chart.subscribeAction(ActionType.OnPaneDrag, handlePaneDrag)
  chart.subscribeAction(ActionType.OnZoom, handleChartChange)
  window.addEventListener(settingsSymbolChangedEvent, handleSettingsChange)
  window.addEventListener(kLineChartHorizontalDragEndEventV2, handleChartChange)
  window.addEventListener('resize', handleChartChange)
  scheduleRender()

  return {
    destroy() {
      destroyed = true
      rafScheduler.destroy()
      chart.unsubscribeAction(ActionType.OnDataReady, handleChartChange)
      chart.unsubscribeAction(ActionType.OnScroll, handleHorizontalRangeChange)
      chart.unsubscribeAction(ActionType.OnVisibleRangeChange, handleHorizontalRangeChange)
      chart.unsubscribeAction(ActionType.OnPaneDrag, handlePaneDrag)
      chart.unsubscribeAction(ActionType.OnZoom, handleChartChange)
      window.removeEventListener(settingsSymbolChangedEvent, handleSettingsChange)
      window.removeEventListener(kLineChartHorizontalDragEndEventV2, handleChartChange)
      window.removeEventListener('resize', handleChartChange)
      mainPaneResizeObserver.disconnect()
      mainRoot.remove()
    },
    scheduleRender,
    updateFrame(nextFrame: KLineChartRenderFrameV2) {
      frame = nextFrame
      scheduleRender()
    },
    updatePageNavigation(nextPageNavigation?: ChartPageNavigation | null) {
      pageNavigation = nextPageNavigation ?? null
      scheduleRender()
    },
  }
}
