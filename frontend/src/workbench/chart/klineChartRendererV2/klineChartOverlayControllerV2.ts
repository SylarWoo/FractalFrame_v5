import type { Chart } from 'klinecharts'
import type { ChartPageNavigation } from '../chartRuntimeTypes'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { KLineChartDisplayContext } from './klineChartDisplayControls'
import { installKLineChartAxisLabelLayerV2 } from './KLineChartAxisLabelLayerV2'
import { installKLineChartRealtimePaneV2 } from './KLineChartRealtimePaneV2'
import { installKLineChartIndicatorLifecycleV2 } from './klineChartIndicatorLifecycleV2'

type OverlayControllerOptionsV2 = {
  chart: Chart
  container: HTMLElement
  displayContext: () => KLineChartDisplayContext
  frame: KLineChartRenderFrameV2
  pageNavigation?: ChartPageNavigation | null
}

type OverlayPerfEntryV2 = {
  at: number
  frameKey: string
  ms: number
  name: string
}

declare global {
  interface Window {
    __ffKLineChartV2OverlayPerf?: {
      entries: OverlayPerfEntryV2[]
      totals: Record<string, {
        count: number
        maxMs: number
        totalMs: number
      }>
    }
  }
}

function recordOverlayPerf(name: string, frame: KLineChartRenderFrameV2, ms: number) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const debug = window.__ffKLineChartV2OverlayPerf ?? {
    entries: [],
    totals: {},
  }
  debug.entries.push({
    at: Date.now(),
    frameKey: frame.key,
    ms: Number(ms.toFixed(3)),
    name,
  })
  if (debug.entries.length > 300) debug.entries.splice(0, debug.entries.length - 300)
  const total = debug.totals[name] ?? { count: 0, maxMs: 0, totalMs: 0 }
  total.count += 1
  total.totalMs += ms
  total.maxMs = Math.max(total.maxMs, ms)
  debug.totals[name] = total
  window.__ffKLineChartV2OverlayPerf = debug
}

function timedOverlayUpdate(name: string, frame: KLineChartRenderFrameV2, update: () => void) {
  const start = performance.now()
  update()
  recordOverlayPerf(name, frame, performance.now() - start)
}

export function installKLineChartOverlayControllerV2(options: OverlayControllerOptionsV2) {
  const realtimePane = installKLineChartRealtimePaneV2(options.chart, options.container, options.frame, options.pageNavigation)
  const axisLabelLayer = installKLineChartAxisLabelLayerV2(options.chart, options.container, () => ({
    period: options.displayContext().period,
    symbol: options.displayContext().symbol,
  }))
  const indicatorLifecycle = installKLineChartIndicatorLifecycleV2(options.chart, options.frame)

  return {
    destroy() {
      realtimePane.destroy()
      axisLabelLayer.destroy()
      indicatorLifecycle.destroy()
    },
    scheduleAxisLabelRender() {
      axisLabelLayer.scheduleRender()
    },
    scheduleMainPriceScaleRender() {
      indicatorLifecycle.scheduleMainPriceScaleRender()
    },
    updateDisplayContext() {
      axisLabelLayer.updateContext()
    },
    updateFrame(frame: KLineChartRenderFrameV2) {
      timedOverlayUpdate('realtimePane', frame, () => realtimePane.updateFrame(frame))
      timedOverlayUpdate('axisLabelLayer', frame, () => axisLabelLayer.scheduleRender())
      indicatorLifecycle.updateFrame(frame)
    },
    updatePageNavigation(pageNavigation?: ChartPageNavigation | null) {
      realtimePane.updatePageNavigation(pageNavigation)
    },
  }
}
