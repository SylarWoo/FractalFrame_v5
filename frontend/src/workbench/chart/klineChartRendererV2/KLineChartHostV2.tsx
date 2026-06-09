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
} from './klineChartRenderStateControllerV2'
import { installKLineChartMainYAxisInteractionV2 } from './klineChartMainYAxisInteractionV2'
import { installKLineChartRealtimePaneV2 } from './KLineChartRealtimePaneV2'
import { setKLineChartRealtimeXAxisFrameV2 } from './klineChartRealtimeXAxisV2'
import { KLineChartSubPaneStackV2 } from './KLineChartSubPaneStackV2'
import { installKLineChartViewportStateV2 } from './klineChartViewportStateV2'
import { installKLineChartYAxisRestorePersistenceV2 } from './klineChartYAxisRestoreV2'
import { installKLineChartMainVolumeOverlayV2 } from './klineChartMainVolumeOverlayV2'
import { installKLineChartMainMaOverlayV2 } from './klineChartMainMaOverlayV2'
import { installKLineChartMainMorganRangeOverlayV2 } from './klineChartMainMorganRangeOverlayV2'
import { installKLineChartMainVwapOverlayV2 } from './klineChartMainVwapOverlayV2'
import { installKLineChartSubPaneStochV2 } from './klineChartSubPaneStochV2'
import { installKLineChartAxisLabelLayerV2 } from './KLineChartAxisLabelLayerV2'
import {
  buildKLineChartRenderWindowKeyV2,
  canApplyKLineChartPaneOnlyUpdateV2,
  canApplyKLineChartTailUpdateV2,
} from './klineChartFrameLifecycleV2'
import { recordKLineChartProbeEventV2 } from './klineChartProbeV2'
import { traceKLineChartPageV2 } from './klineChartPageDebugProbeV2'
import { applyKLineChartFrameTailUpdate, applyKLineChartFrameToChart } from './klineChartRenderer'
import './klineChartHostV2.css'

declare global {
  interface Window {
    __ffKLineChartV2?: Chart | null
    __ffKLineChartV2FrameDebug?: unknown
  }
}

type KLineChartHostV2Props = {
  displayName?: string
  frame: KLineChartRenderFrameV2
  onLoadStateChange?: (state: ChartLoadState) => void
  pageNavigation?: ChartPageNavigation | null
  totalRows?: number | null
}

export function KLineChartHostV2({
  displayName,
  frame,
  onLoadStateChange,
  pageNavigation,
  totalRows,
}: KLineChartHostV2Props) {
  const chartRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<Chart | null>(null)
  const displayControllerRef = useRef<ReturnType<typeof installKLineChartDisplayController> | null>(null)
  const realtimePaneRef = useRef<ReturnType<typeof installKLineChartRealtimePaneV2> | null>(null)
  const mainMaOverlayRef = useRef<ReturnType<typeof installKLineChartMainMaOverlayV2> | null>(null)
  const mainMorganRangeOverlayRef = useRef<ReturnType<typeof installKLineChartMainMorganRangeOverlayV2> | null>(null)
  const mainVwapOverlayRef = useRef<ReturnType<typeof installKLineChartMainVwapOverlayV2> | null>(null)
  const mainVolumeOverlayRef = useRef<ReturnType<typeof installKLineChartMainVolumeOverlayV2> | null>(null)
  const subPaneStochRef = useRef<ReturnType<typeof installKLineChartSubPaneStochV2> | null>(null)
  const axisLabelLayerRef = useRef<ReturnType<typeof installKLineChartAxisLabelLayerV2> | null>(null)
  const yAxisInteractionRef = useRef<ReturnType<typeof installKLineChartMainYAxisInteractionV2> | null>(null)
  const yAxisStateRef = useRef<ReturnType<typeof installKLineChartYAxisRestorePersistenceV2> | null>(null)
  const appliedFrameKeyRef = useRef('')
  const appliedRenderWindowKeyRef = useRef('')
  const previousFrameRef = useRef<KLineChartRenderFrameV2 | null>(null)
  const renderStateControllerRef = useRef<ReturnType<typeof createKLineChartRenderStateControllerV2> | null>(null)
  const viewportStateRef = useRef<ReturnType<typeof installKLineChartViewportStateV2> | null>(null)
  const displayContextRef = useRef({ displayName, period: frame.period, realtimeStart: pageNavigation?.realtimeStart ?? null, symbol: frame.symbol })

  displayContextRef.current = { displayName, period: frame.period, realtimeStart: pageNavigation?.realtimeStart ?? null, symbol: frame.symbol }
  if (import.meta.env.DEV) {
    window.__ffKLineChartV2FrameDebug = {
      frameKey: frame.key,
      mainRows: frame.mainRows.length,
      realtimeSegment: frame.segments.realtime ?? null,
      symbol: frame.symbol,
    }
  }

  useEffect(() => {
    if (!chartRef.current) return
    const container = chartRef.current
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
      yAxisInteractionRef.current = installKLineChartMainYAxisInteractionV2(chart, {
        onRangeChange: () => yAxisStateRef.current?.saveNow(),
      })
      displayControllerRef.current = installKLineChartDisplayController(chart, container, displayContextRef.current)
      realtimePaneRef.current = installKLineChartRealtimePaneV2(chart, container, frame, pageNavigation)
      axisLabelLayerRef.current = installKLineChartAxisLabelLayerV2(chart, container, () => ({
        period: displayContextRef.current.period,
        symbol: displayContextRef.current.symbol,
      }))
      mainMaOverlayRef.current = installKLineChartMainMaOverlayV2(chart, frame)
      mainMorganRangeOverlayRef.current = installKLineChartMainMorganRangeOverlayV2(chart, frame)
      mainVwapOverlayRef.current = installKLineChartMainVwapOverlayV2(chart, frame)
      mainVolumeOverlayRef.current = installKLineChartMainVolumeOverlayV2(chart, frame)
      subPaneStochRef.current = installKLineChartSubPaneStochV2(chart, frame)
      viewportStateRef.current = installKLineChartViewportStateV2(chart, () => ({
        period: displayContextRef.current.period,
        symbol: displayContextRef.current.symbol,
      }))
      renderStateControllerRef.current = createKLineChartRenderStateControllerV2(chart, () => viewportStateRef.current)
    }

    let resizeFrameId = 0
    const resize = () => {
      resizeFrameId = 0
      chart?.resize()
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
      displayControllerRef.current?.destroy()
      displayControllerRef.current = null
      yAxisInteractionRef.current?.destroy()
      yAxisInteractionRef.current = null
      yAxisStateRef.current?.destroy()
      yAxisStateRef.current = null
      realtimePaneRef.current?.destroy()
      realtimePaneRef.current = null
      axisLabelLayerRef.current?.destroy()
      axisLabelLayerRef.current = null
      mainMaOverlayRef.current?.destroy()
      mainMaOverlayRef.current = null
      mainMorganRangeOverlayRef.current?.destroy()
      mainMorganRangeOverlayRef.current = null
      mainVwapOverlayRef.current?.destroy()
      mainVwapOverlayRef.current = null
      mainVolumeOverlayRef.current?.destroy()
      mainVolumeOverlayRef.current = null
      subPaneStochRef.current?.destroy()
      subPaneStochRef.current = null
      viewportStateRef.current?.destroy()
      viewportStateRef.current = null
      renderStateControllerRef.current = null
      chartInstanceRef.current = null
      if (import.meta.env.DEV) window.__ffKLineChartV2 = null
      if (chart) dispose(chart)
    }
  }, [])

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return
    displayControllerRef.current?.updateContext(displayContextRef.current)
    axisLabelLayerRef.current?.updateContext()
  }, [displayName, frame.period, frame.symbol, pageNavigation?.realtimeStart])

  useEffect(() => {
    const chart = chartInstanceRef.current
    const renderStateController = renderStateControllerRef.current
    if (!chart || !renderStateController) return
    const renderWindowKey = buildKLineChartRenderWindowKeyV2(frame)
    const sameRenderWindow = appliedRenderWindowKeyRef.current === renderWindowKey
    traceKLineChartPageV2('KLineChartHost.frame.received', {
      frameKey: frame.key,
      historyKey: frame.segments.history.key,
      mainRows: frame.mainRows.length,
      pageIndex: frame.pageIndex,
      realtimeRows: frame.segments.realtime?.rows ?? 0,
      renderWindowKey,
      sameRenderWindow,
    })
    if (appliedFrameKeyRef.current === frame.key) {
      recordKLineChartProbeEventV2({
        frame,
        reason: 'same-frame-key',
        renderWindowKey,
        sameRenderWindow,
        type: 'skipped',
      })
      return
    }
    setKLineChartRealtimeXAxisFrameV2(frame)
    if (import.meta.env.DEV) {
      window.__ffKLineChartV2FrameDebug = {
        applied: true,
        frameKey: frame.key,
        mainRows: frame.mainRows.length,
        realtimeSegment: frame.segments.realtime ?? null,
        symbol: frame.symbol,
      }
    }
    const previousFrame = previousFrameRef.current
    const canPaneOnlyUpdate = canApplyKLineChartPaneOnlyUpdateV2({
      current: frame,
      previous: previousFrame,
      sameRenderWindow,
    })
    if (canPaneOnlyUpdate) {
      recordKLineChartProbeEventV2({
        frame,
        renderWindowKey,
        sameRenderWindow,
        type: 'pane-only',
      })
      appliedFrameKeyRef.current = frame.key
      previousFrameRef.current = frame
      setKLineChartRealtimeXAxisFrameV2(frame)
      realtimePaneRef.current?.updateFrame(frame)
      realtimePaneRef.current?.updatePageNavigation(pageNavigation)
      axisLabelLayerRef.current?.scheduleRender()
      mainMaOverlayRef.current?.updateFrame(frame)
      mainMorganRangeOverlayRef.current?.updateFrame(frame)
      mainVwapOverlayRef.current?.updateFrame(frame)
      mainVolumeOverlayRef.current?.updateFrame(frame)
      subPaneStochRef.current?.updateFrame(frame)
      displayControllerRef.current?.scheduleApply()
      onLoadStateChange?.({
        error: false,
        loadedPeriod: frame.period,
        loadedSymbol: frame.symbol,
        loading: false,
        loadingMore: false,
        period: frame.period,
        requestedRows: frame.mainRows.length,
        rows: frame.mainRows.length,
        symbol: frame.symbol,
        totalRows,
      })
      return
    }
    const canTailUpdate = canApplyKLineChartTailUpdateV2({
      current: frame,
      previous: previousFrame,
      sameRenderWindow,
    })
    if (canTailUpdate) {
      recordKLineChartProbeEventV2({
        frame,
        renderWindowKey,
        sameRenderWindow,
        type: 'tail-update',
      })
      appliedFrameKeyRef.current = frame.key
      previousFrameRef.current = frame
      const result = applyKLineChartFrameTailUpdate(chart, frame)
      setKLineChartRealtimeXAxisFrameV2(frame)
      realtimePaneRef.current?.updateFrame(frame)
      realtimePaneRef.current?.updatePageNavigation(pageNavigation)
      axisLabelLayerRef.current?.scheduleRender()
      mainMaOverlayRef.current?.updateFrame(frame)
      mainMorganRangeOverlayRef.current?.updateFrame(frame)
      mainVwapOverlayRef.current?.updateFrame(frame)
      mainVolumeOverlayRef.current?.updateFrame(frame)
      subPaneStochRef.current?.updateFrame(frame)
      onLoadStateChange?.({
        error: false,
        loadedPeriod: result.period,
        loadedSymbol: result.symbol,
        loading: false,
        loadingMore: false,
        period: result.period,
        requestedRows: result.rows,
        rows: result.rows,
        symbol: result.symbol,
        totalRows,
      })
      return
    }
    recordKLineChartProbeEventV2({
      frame,
      renderWindowKey,
      sameRenderWindow,
      type: 'full-frame',
    })
    appliedFrameKeyRef.current = frame.key
    appliedRenderWindowKeyRef.current = renderWindowKey
    chartRef.current?.setAttribute('data-restoring', 'true')
    const restorePlan = renderStateController.beginFrameRestore(frame, { sameRenderWindow })
    const restoreViewport = () => {
      const restored = restorePlan.restoreViewport?.() === true
      window.requestAnimationFrame(() => {
        chartRef.current?.removeAttribute('data-restoring')
      })
      return restored
    }
    const result = applyKLineChartFrameToChart(chart, frame, () => {
      setKLineChartRealtimeXAxisFrameV2(frame)
      renderStateController.handleDataReady()
      realtimePaneRef.current?.updateFrame(frame)
      realtimePaneRef.current?.updatePageNavigation(pageNavigation)
      axisLabelLayerRef.current?.scheduleRender()
      mainMaOverlayRef.current?.updateFrame(frame)
      mainMorganRangeOverlayRef.current?.updateFrame(frame)
      mainVwapOverlayRef.current?.updateFrame(frame)
      mainVolumeOverlayRef.current?.updateFrame(frame)
      subPaneStochRef.current?.updateFrame(frame)
    }, {
      anchorRealtimeBoundary: restorePlan.anchorRealtimeBoundary,
      preserveVisibleRange: restorePlan.preserveVisibleRange,
      restoreViewport,
    })
    previousFrameRef.current = frame
    realtimePaneRef.current?.updateFrame(frame)
    realtimePaneRef.current?.updatePageNavigation(pageNavigation)
    displayControllerRef.current?.scheduleApply()
    mainMaOverlayRef.current?.updateFrame(frame)
    mainMorganRangeOverlayRef.current?.updateFrame(frame)
    mainVwapOverlayRef.current?.updateFrame(frame)
    mainVolumeOverlayRef.current?.updateFrame(frame)
    subPaneStochRef.current?.updateFrame(frame)
    onLoadStateChange?.({
      error: false,
      loadedPeriod: result.period,
      loadedSymbol: result.symbol,
      loading: false,
      loadingMore: false,
      period: result.period,
      requestedRows: result.rows,
      rows: result.rows,
      symbol: result.symbol,
      totalRows,
    })
  }, [frame, frame.key, onLoadStateChange, totalRows])

  useEffect(() => {
    setKLineChartRealtimeXAxisFrameV2(frame)
    realtimePaneRef.current?.updateFrame(frame)
    realtimePaneRef.current?.updatePageNavigation(pageNavigation)
    axisLabelLayerRef.current?.scheduleRender()
    mainMaOverlayRef.current?.updateFrame(frame)
    mainMorganRangeOverlayRef.current?.updateFrame(frame)
    mainVwapOverlayRef.current?.updateFrame(frame)
    mainVolumeOverlayRef.current?.updateFrame(frame)
    subPaneStochRef.current?.updateFrame(frame)
  }, [frame, pageNavigation])

  return (
    <section className="ff-kline-chart-host-v2" data-loading={false} aria-label={`${frame.symbol} ${frame.period} chart`}>
      <KLineChartMainPaneV2 ref={chartRef} />
      <KLineChartSubPaneStackV2 panes={frame.panes} />
      <KLineChartOverlayLayerV2 chartInstanceRef={chartInstanceRef} frame={frame} />
    </section>
  )
}
