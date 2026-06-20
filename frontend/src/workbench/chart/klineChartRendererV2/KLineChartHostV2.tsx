import { useEffect, useRef } from 'react'
import { dispose, init } from 'klinecharts'
import type { Chart } from 'klinecharts'
import type { ChartLoadState } from '../chartRuntimeTypes'
import type { ChartPageNavigation } from '../chartRuntimeTypes'
import {
  createKLineChartDisplayInitOptions,
  installKLineChartDisplayController,
} from './klineChartDisplayControls'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { KLineChartMainPaneV2 } from './KLineChartMainPaneV2'
import { KLineChartOverlayLayerV2 } from './KLineChartOverlayLayerV2'
import {
  applyKLineChartPreDataRenderConfigV2,
  createKLineChartRenderStateControllerV2,
  resolveKLineChartViewportScopeV2,
} from './klineChartRenderStateControllerV2'
import { installKLineChartMainYAxisInteractionV2 } from './klineChartMainYAxisInteractionV2'
import { setKLineChartRealtimeXAxisFrameV2 } from './klineChartRealtimeXAxisV2'
import { KLineChartSubPaneStackV2 } from './KLineChartSubPaneStackV2'
import { installKLineChartViewportStateV2 } from './klineChartViewportStateV2'
import { installKLineChartYAxisRestorePersistenceV2 } from './klineChartYAxisRestoreV2'
import { installKLineChartSubPaneHeightResizePersistenceV2 } from './klineChartSubPaneHeightLifecycleV2'
import { installKLineChartOverlayControllerV2 } from './klineChartOverlayControllerV2'
import { applyKLineChartFrameUpdateV2 } from './klineChartFrameApplyControllerV2'
import { installKLineChartBenchmarkV2 } from './klineChartBenchmarkV2'
import { installKLineChartMouseEventControllerV2 } from './klineChartMouseEventControllerV2'
import { installChartDrawingModule } from '../chartDrawingModule'
import { installKLineChartMorganRangeSegmentPublisherV2 } from './klineChartMorganRangeSegmentPublisherV2'
import type { MorganRangeSegment } from '../morganRangeModel'
import './klineChartHostV2.css'

declare global {
  interface Window {
    __ffKLineChartV2?: Chart | null
    __ffKLineChartV2FrameDebug?: unknown
    __ffKLineChartV2RestorePlanDebug?: unknown
  }
}

type KLineChartHostV2Props = {
  displayName?: string
  frame: KLineChartRenderFrameV2
  onLoadStateChange?: (state: ChartLoadState) => void
  onMorganRangeSegmentChange?: (segment: MorganRangeSegment | null) => void
  pageNavigation?: ChartPageNavigation | null
  totalRows?: number | null
}

export function KLineChartHostV2({
  displayName,
  frame,
  onLoadStateChange,
  onMorganRangeSegmentChange,
  pageNavigation,
  totalRows,
}: KLineChartHostV2Props) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<Chart | null>(null)
  const displayControllerRef = useRef<ReturnType<typeof installKLineChartDisplayController> | null>(null)
  const overlayControllerRef = useRef<ReturnType<typeof installKLineChartOverlayControllerV2> | null>(null)
  const yAxisInteractionRef = useRef<ReturnType<typeof installKLineChartMainYAxisInteractionV2> | null>(null)
  const yAxisStateRef = useRef<ReturnType<typeof installKLineChartYAxisRestorePersistenceV2> | null>(null)
  const subPaneHeightPersistenceRef = useRef<ReturnType<typeof installKLineChartSubPaneHeightResizePersistenceV2> | null>(null)
  const appliedFrameKeyRef = useRef('')
  const appliedRenderWindowKeyRef = useRef('')
  const previousFrameRef = useRef<KLineChartRenderFrameV2 | null>(null)
  const renderStateControllerRef = useRef<ReturnType<typeof createKLineChartRenderStateControllerV2> | null>(null)
  const viewportStateRef = useRef<ReturnType<typeof installKLineChartViewportStateV2> | null>(null)
  const benchmarkRef = useRef<ReturnType<typeof installKLineChartBenchmarkV2> | null>(null)
  const mouseEventControllerRef = useRef<ReturnType<typeof installKLineChartMouseEventControllerV2> | null>(null)
  const drawingModuleRef = useRef<ReturnType<typeof installChartDrawingModule> | null>(null)
  const morganRangeSegmentPublisherRef = useRef<ReturnType<typeof installKLineChartMorganRangeSegmentPublisherV2> | null>(null)
  const realtimeVisualOpen = Boolean(frame.segments.realtime)
  const displayContextRef = useRef({
    displayName,
    period: frame.period,
    realtimeStart: pageNavigation?.realtimeStart ?? null,
    realtimeVisualOpen,
    symbol: frame.symbol,
    viewportScope: resolveKLineChartViewportScopeV2(frame),
  })

  displayContextRef.current = {
    displayName,
    period: frame.period,
    realtimeStart: pageNavigation?.realtimeStart ?? null,
    realtimeVisualOpen,
    symbol: frame.symbol,
    viewportScope: resolveKLineChartViewportScopeV2(frame),
  }
  if (import.meta.env.DEV) {
    window.__ffKLineChartV2FrameDebug = {
      frameKey: frame.key,
      mainRows: frame.mainRows.length,
      realtimeSegment: frame.segments.realtime ?? null,
      symbol: frame.symbol,
      viewportScope: resolveKLineChartViewportScopeV2(frame),
    }
  }
  useEffect(() => {
    if (!chartRef.current) return
    const container = chartRef.current
    appliedFrameKeyRef.current = ''
    appliedRenderWindowKeyRef.current = ''
    previousFrameRef.current = null
    setKLineChartRealtimeXAxisFrameV2(frame)
    const chart = init(container, createKLineChartDisplayInitOptions())
    chartInstanceRef.current = chart ?? null
    if (import.meta.env.DEV) window.__ffKLineChartV2 = chart ?? null
    if (chart) {
      applyKLineChartPreDataRenderConfigV2(chart)
      yAxisStateRef.current = installKLineChartYAxisRestorePersistenceV2(chart, () => ({
        period: displayContextRef.current.period,
        symbol: displayContextRef.current.symbol,
      }))
      subPaneHeightPersistenceRef.current = installKLineChartSubPaneHeightResizePersistenceV2(chart, container)
      yAxisInteractionRef.current = installKLineChartMainYAxisInteractionV2(chart, {
        onRangeChange: () => {
          yAxisStateRef.current?.saveNow()
          overlayControllerRef.current?.scheduleMainPriceScaleRender()
        },
      })
      displayControllerRef.current = installKLineChartDisplayController(chart, container, displayContextRef.current)
      overlayControllerRef.current = installKLineChartOverlayControllerV2({
        chart,
        container,
        displayContext: () => displayContextRef.current,
        frame,
        pageNavigation,
      })
      viewportStateRef.current = installKLineChartViewportStateV2(chart, () => ({
        period: displayContextRef.current.period,
        symbol: displayContextRef.current.symbol,
        viewportScope: displayContextRef.current.viewportScope,
      }))
      renderStateControllerRef.current = createKLineChartRenderStateControllerV2(chart, () => viewportStateRef.current)
      benchmarkRef.current = installKLineChartBenchmarkV2(chart, () => previousFrameRef.current ?? frame)
      mouseEventControllerRef.current = installKLineChartMouseEventControllerV2(chart, container)
      morganRangeSegmentPublisherRef.current = installKLineChartMorganRangeSegmentPublisherV2({
        chart,
        frame,
        onSegmentChange: onMorganRangeSegmentChange,
      })
      drawingModuleRef.current = installChartDrawingModule({
        chart,
        initialContext: {
          period: displayContextRef.current.period,
          symbol: displayContextRef.current.symbol,
          viewportScope: displayContextRef.current.viewportScope,
        },
      })
    }

    let resizeFrameId = 0
    const resize = () => {
      resizeFrameId = 0
      chart?.resize()
      overlayControllerRef.current?.scheduleRealtimePaneRender()
    }
    const scheduleResize = () => {
      if (resizeFrameId !== 0) return
      resizeFrameId = window.requestAnimationFrame(resize)
    }
    const resizeObserver = new ResizeObserver(scheduleResize)
    resizeObserver.observe(container)
    window.addEventListener('resize', scheduleResize)
    scheduleResize()

    return () => {
      if (resizeFrameId !== 0) window.cancelAnimationFrame(resizeFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleResize)
      mouseEventControllerRef.current?.destroy()
      mouseEventControllerRef.current = null
      displayControllerRef.current?.destroy()
      displayControllerRef.current = null
      yAxisInteractionRef.current?.destroy()
      yAxisInteractionRef.current = null
      yAxisStateRef.current?.destroy()
      yAxisStateRef.current = null
      subPaneHeightPersistenceRef.current?.destroy()
      subPaneHeightPersistenceRef.current = null
      overlayControllerRef.current?.destroy()
      overlayControllerRef.current = null
      viewportStateRef.current?.destroy()
      viewportStateRef.current = null
      benchmarkRef.current?.destroy()
      benchmarkRef.current = null
      morganRangeSegmentPublisherRef.current?.destroy()
      morganRangeSegmentPublisherRef.current = null
      drawingModuleRef.current?.destroy()
      drawingModuleRef.current = null
      renderStateControllerRef.current = null
      chartInstanceRef.current = null
      if (import.meta.env.DEV) window.__ffKLineChartV2 = null
      if (chart) dispose(chart)
    }
  }, [])

  useEffect(() => {
    morganRangeSegmentPublisherRef.current?.updateHandler(onMorganRangeSegmentChange)
  }, [onMorganRangeSegmentChange])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return
    displayControllerRef.current?.updateContext(displayContextRef.current)
    overlayControllerRef.current?.updateDisplayContext()
    mouseEventControllerRef.current?.refreshCursorMode()
    drawingModuleRef.current?.updateContext({
      period: frame.period,
      symbol: frame.symbol,
      viewportScope: displayContextRef.current.viewportScope,
    })
  }, [displayName, frame.period, frame.symbol, pageNavigation?.realtimeStart, realtimeVisualOpen])

  useEffect(() => {
    const chart = chartInstanceRef.current
    const renderStateController = renderStateControllerRef.current
    if (!chart || !renderStateController) return
    applyKLineChartFrameUpdateV2({
      appliedFrameKey: appliedFrameKeyRef.current,
      appliedRenderWindowKey: appliedRenderWindowKeyRef.current,
      chart,
      chartRoot: chartRef.current,
      dragInProgress: mouseEventControllerRef.current?.isHorizontalDragInProgress() === true,
      displayController: displayControllerRef.current,
      frame,
      onAppliedFrameKeyChange: (key) => {
        appliedFrameKeyRef.current = key
      },
      onAppliedRenderWindowKeyChange: (key) => {
        appliedRenderWindowKeyRef.current = key
      },
      onLoadStateChange,
      onPreviousFrameChange: (nextFrame) => {
        previousFrameRef.current = nextFrame
      },
      overlayController: overlayControllerRef.current,
      pageNavigation,
      previousFrame: previousFrameRef.current,
      renderStateController,
      totalRows,
    })
    morganRangeSegmentPublisherRef.current?.updateFrame(frame)
  }, [frame, frame.key, onLoadStateChange, totalRows])

  return (
    <section className="ff-kline-chart-host-v2" data-loading={false} aria-label={`${frame.symbol} ${frame.period} chart`}>
      <KLineChartMainPaneV2 ref={chartRef} />
      <KLineChartSubPaneStackV2 panes={frame.panes} />
      <KLineChartOverlayLayerV2 chartInstanceRef={chartInstanceRef} frame={frame} />
    </section>
  )
}
