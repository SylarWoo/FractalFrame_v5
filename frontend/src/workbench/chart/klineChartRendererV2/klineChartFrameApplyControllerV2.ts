import type { Chart } from 'klinecharts'
import type { ChartLoadState, ChartPageNavigation } from '../chartRuntimeTypes'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  buildKLineChartRenderWindowKeyV2,
  canApplyKLineChartPaneOnlyUpdateV2,
  canApplyKLineChartTailUpdateV2,
} from './klineChartFrameLifecycleV2'
import {
  applyKLineChartPageJumpMovementV2,
  resolveKLineChartPageJumpMovementV2,
} from './klineChartPageJumpMovementV2'
import { recordKLineChartProbeEventV2 } from './klineChartProbeV2'
import { traceKLineChartPageV2 } from './klineChartPageDebugProbeV2'
import { applyKLineChartFrameTailUpdate, applyKLineChartFrameToChart } from './klineChartRenderer'
import { resolveKLineChartViewportScopeV2 } from './klineChartRenderStateControllerV2'
import { setKLineChartRealtimeXAxisFrameV2 } from './klineChartRealtimeXAxisV2'

declare global {
  interface Window {
    __ffKLineChartV2ApplyPerf?: {
      entries: KLineChartFrameApplyPerfEntryV2[]
    }
    __ffKLineChartV2FrameDebug?: unknown
    __ffKLineChartV2RestorePlanDebug?: unknown
  }
}

type KLineChartFrameApplyPerfEntryV2 = {
  applyMs: number
  at: number
  frameKey: string
  mainRows: number
  overlayMs: number
  restoreViewportMs: number
  totalMs: number
  type: 'full-frame' | 'tail-update' | 'pane-only' | 'skipped'
}

type KLineChartRenderStateControllerLikeV2 = {
  beginFrameRestore: (
    frame: KLineChartRenderFrameV2,
    options: {
      pageJumpMovement?: ReturnType<typeof resolveKLineChartPageJumpMovementV2> | null
      sameRenderWindow: boolean
    },
  ) => {
    anchorRealtimeBoundary: boolean
    preserveVisibleRange: boolean
    restoreViewport?: () => boolean
  }
  handleDataReady: () => void
}

type KLineChartOverlayControllerLikeV2 = {
  updateFrame: (frame: KLineChartRenderFrameV2) => void
  updatePageNavigation: (pageNavigation?: ChartPageNavigation | null) => void
}

type KLineChartDisplayControllerLikeV2 = {
  scheduleApply: () => void
}

export type ApplyKLineChartFrameUpdateV2Options = {
  appliedFrameKey: string
  appliedRenderWindowKey: string
  chart: Chart
  chartRoot: HTMLElement | null
  dragInProgress: boolean
  displayController: KLineChartDisplayControllerLikeV2 | null
  frame: KLineChartRenderFrameV2
  onAppliedFrameKeyChange: (key: string) => void
  onAppliedRenderWindowKeyChange: (key: string) => void
  onLoadStateChange?: (state: ChartLoadState) => void
  onPreviousFrameChange: (frame: KLineChartRenderFrameV2) => void
  overlayController: KLineChartOverlayControllerLikeV2 | null
  pageNavigation?: ChartPageNavigation | null
  previousFrame: KLineChartRenderFrameV2 | null
  renderStateController: KLineChartRenderStateControllerLikeV2
  totalRows?: number | null
}

function publishFrameDebug(frame: KLineChartRenderFrameV2, pageJumpMovement: ReturnType<typeof resolveKLineChartPageJumpMovementV2>) {
  if (!import.meta.env.DEV) return
  window.__ffKLineChartV2FrameDebug = {
    applied: true,
    frameKey: frame.key,
    mainRows: frame.mainRows.length,
    pageJumpMovement,
    realtimeSegment: frame.segments.realtime ?? null,
    symbol: frame.symbol,
    viewportScope: resolveKLineChartViewportScopeV2(frame),
  }
}

function emitLoadState(options: {
  frame: KLineChartRenderFrameV2
  onLoadStateChange?: (state: ChartLoadState) => void
  rows: number
  totalRows?: number | null
}) {
  options.onLoadStateChange?.({
    error: false,
    loadedPeriod: options.frame.period,
    loadedSymbol: options.frame.symbol,
    loading: false,
    loadingMore: false,
    period: options.frame.period,
    requestedRows: options.rows,
    rows: options.rows,
    symbol: options.frame.symbol,
    totalRows: options.totalRows,
  })
}

function updateFrameOverlays(options: {
  frame: KLineChartRenderFrameV2
  overlayController: KLineChartOverlayControllerLikeV2 | null
  pageNavigation?: ChartPageNavigation | null
}) {
  options.overlayController?.updateFrame(options.frame)
  options.overlayController?.updatePageNavigation(options.pageNavigation)
}

function publishApplyPerf(entry: KLineChartFrameApplyPerfEntryV2) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const debug = window.__ffKLineChartV2ApplyPerf ?? { entries: [] }
  debug.entries.push(entry)
  if (debug.entries.length > 180) debug.entries.splice(0, debug.entries.length - 180)
  window.__ffKLineChartV2ApplyPerf = debug
}

function timedOverlayUpdate(options: Parameters<typeof updateFrameOverlays>[0]) {
  const start = performance.now()
  updateFrameOverlays(options)
  return performance.now() - start
}

export function applyKLineChartFrameUpdateV2(options: ApplyKLineChartFrameUpdateV2Options) {
  const totalStart = performance.now()
  const renderWindowKey = buildKLineChartRenderWindowKeyV2(options.frame)
  const sameRenderWindow = options.appliedRenderWindowKey === renderWindowKey
  const pageJumpMovement = resolveKLineChartPageJumpMovementV2(options.previousFrame, options.frame)
  if (import.meta.env.DEV) {
    window.__ffKLineChartV2RestorePlanDebug = {
      framePageIndex: options.frame.pageIndex,
      pageJumpMovement,
      previousFramePageIndex: options.previousFrame?.pageIndex ?? null,
      previousFrameSymbol: options.previousFrame?.symbol ?? null,
      renderWindowKey,
      sameRenderWindow,
    }
  }
  traceKLineChartPageV2('KLineChartHost.frame.received', {
    frameKey: options.frame.key,
    historyKey: options.frame.segments.history.key,
    mainRows: options.frame.mainRows.length,
    pageIndex: options.frame.pageIndex,
    pageJumpMovement,
    realtimeRows: options.frame.segments.realtime?.rows ?? 0,
    renderWindowKey,
    sameRenderWindow,
  })
  if (options.appliedFrameKey === options.frame.key) {
    recordKLineChartProbeEventV2({
      frame: options.frame,
      reason: 'same-frame-key',
      renderWindowKey,
      sameRenderWindow,
      type: 'skipped',
    })
    publishApplyPerf({
      applyMs: 0,
      at: Date.now(),
      frameKey: options.frame.key,
      mainRows: options.frame.mainRows.length,
      overlayMs: 0,
      restoreViewportMs: 0,
      totalMs: Number((performance.now() - totalStart).toFixed(3)),
      type: 'skipped',
    })
    return
  }
  setKLineChartRealtimeXAxisFrameV2(options.frame)
  publishFrameDebug(options.frame, pageJumpMovement)

  const canPaneOnlyUpdate = canApplyKLineChartPaneOnlyUpdateV2({
    current: options.frame,
    previous: options.previousFrame,
    sameRenderWindow,
  })
  if (canPaneOnlyUpdate) {
    recordKLineChartProbeEventV2({
      frame: options.frame,
      renderWindowKey,
      sameRenderWindow,
      type: 'pane-only',
    })
    options.onAppliedFrameKeyChange(options.frame.key)
    options.onPreviousFrameChange(options.frame)
    setKLineChartRealtimeXAxisFrameV2(options.frame)
    const overlayMs = timedOverlayUpdate(options)
    options.displayController?.scheduleApply()
    emitLoadState({
      frame: options.frame,
      onLoadStateChange: options.onLoadStateChange,
      rows: options.frame.mainRows.length,
      totalRows: options.totalRows,
    })
    publishApplyPerf({
      applyMs: 0,
      at: Date.now(),
      frameKey: options.frame.key,
      mainRows: options.frame.mainRows.length,
      overlayMs: Number(overlayMs.toFixed(3)),
      restoreViewportMs: 0,
      totalMs: Number((performance.now() - totalStart).toFixed(3)),
      type: 'pane-only',
    })
    return
  }

  const canTailUpdate = canApplyKLineChartTailUpdateV2({
    current: options.frame,
    previous: options.previousFrame,
    sameRenderWindow,
  })
  if (canTailUpdate) {
    if (options.dragInProgress) {
      recordKLineChartProbeEventV2({
        frame: options.frame,
        reason: 'chart-drag-in-progress',
        renderWindowKey,
        sameRenderWindow,
        type: 'skipped',
      })
      publishApplyPerf({
        applyMs: 0,
        at: Date.now(),
        frameKey: options.frame.key,
        mainRows: options.frame.mainRows.length,
        overlayMs: 0,
        restoreViewportMs: 0,
        totalMs: Number((performance.now() - totalStart).toFixed(3)),
        type: 'skipped',
      })
      return
    }
    recordKLineChartProbeEventV2({
      frame: options.frame,
      renderWindowKey,
      sameRenderWindow,
      type: 'tail-update',
    })
    options.onAppliedFrameKeyChange(options.frame.key)
    options.onPreviousFrameChange(options.frame)
    const applyStart = performance.now()
    const result = applyKLineChartFrameTailUpdate(options.chart, options.frame)
    const applyMs = performance.now() - applyStart
    setKLineChartRealtimeXAxisFrameV2(options.frame)
    const overlayMs = timedOverlayUpdate(options)
    emitLoadState({
      frame: options.frame,
      onLoadStateChange: options.onLoadStateChange,
      rows: result.rows,
      totalRows: options.totalRows,
    })
    publishApplyPerf({
      applyMs: Number(applyMs.toFixed(3)),
      at: Date.now(),
      frameKey: options.frame.key,
      mainRows: options.frame.mainRows.length,
      overlayMs: Number(overlayMs.toFixed(3)),
      restoreViewportMs: 0,
      totalMs: Number((performance.now() - totalStart).toFixed(3)),
      type: 'tail-update',
    })
    return
  }

  recordKLineChartProbeEventV2({
    frame: options.frame,
    renderWindowKey,
    sameRenderWindow,
    type: 'full-frame',
  })
  options.onAppliedFrameKeyChange(options.frame.key)
  options.onAppliedRenderWindowKeyChange(renderWindowKey)
  options.chartRoot?.setAttribute('data-restoring', 'true')
  const restorePlan = options.renderStateController.beginFrameRestore(options.frame, {
    pageJumpMovement,
    sameRenderWindow,
  })
  const restoreViewport = () => {
    const restoreStart = performance.now()
    const restored = restorePlan.restoreViewport?.() === true
    const restoreMs = performance.now() - restoreStart
    window.requestAnimationFrame(() => {
      options.chartRoot?.removeAttribute('data-restoring')
    })
    window.__ffKLineChartV2RestorePlanDebug = {
      ...(typeof window.__ffKLineChartV2RestorePlanDebug === 'object' && window.__ffKLineChartV2RestorePlanDebug ? window.__ffKLineChartV2RestorePlanDebug : {}),
      restoreViewportMs: Number(restoreMs.toFixed(3)),
    }
    return restored
  }
  const applyStart = performance.now()
  let dataReadyOverlayMs = 0
  const result = applyKLineChartFrameToChart(options.chart, options.frame, () => {
    setKLineChartRealtimeXAxisFrameV2(options.frame)
    options.renderStateController.handleDataReady()
    applyKLineChartPageJumpMovementV2(options.chart, options.frame, pageJumpMovement)
    dataReadyOverlayMs += timedOverlayUpdate(options)
  }, {
    anchorRealtimeBoundary: restorePlan.anchorRealtimeBoundary,
    preserveVisibleRange: restorePlan.preserveVisibleRange,
    restoreViewport,
  })
  const applyMs = performance.now() - applyStart
  options.onPreviousFrameChange(options.frame)
  const overlayMs = dataReadyOverlayMs + timedOverlayUpdate(options)
  options.displayController?.scheduleApply()
  emitLoadState({
    frame: options.frame,
    onLoadStateChange: options.onLoadStateChange,
    rows: result.rows,
    totalRows: options.totalRows,
  })
  const restoreDebug = window.__ffKLineChartV2RestorePlanDebug as { restoreViewportMs?: number } | undefined
  publishApplyPerf({
    applyMs: Number(applyMs.toFixed(3)),
    at: Date.now(),
    frameKey: options.frame.key,
    mainRows: options.frame.mainRows.length,
    overlayMs: Number(overlayMs.toFixed(3)),
    restoreViewportMs: Number(restoreDebug?.restoreViewportMs ?? 0),
    totalMs: Number((performance.now() - totalStart).toFixed(3)),
    type: 'full-frame',
  })
}
