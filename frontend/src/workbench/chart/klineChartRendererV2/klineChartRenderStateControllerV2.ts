import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  applyKLineChartMainContainerSettingsV2,
  kLineChartMainContainerSettingsV2,
} from './klineChartMainContainerSettingsV2'
import type { installKLineChartViewportStateV2 } from './klineChartViewportStateV2'
import { restoreKLineChartViewportStateV2 } from './klineChartViewportStateV2'
import {
  resetKLineChartYAxisToAutoV2,
  restoreKLineChartYAxisAfterDataReadyV2,
} from './klineChartYAxisRestoreV2'
import type { KLineChartPageJumpMovementV2 } from './klineChartPageJumpMovementV2'

type ViewportStateHandle = ReturnType<typeof installKLineChartViewportStateV2>

export type KLineChartFrameRestorePlanV2 = {
  anchorRealtimeBoundary: boolean
  preserveVisibleRange: boolean
  restoreViewport?: () => boolean
}

export function applyKLineChartPreDataRenderConfigV2(chart: Chart) {
  applyKLineChartMainContainerSettingsV2(chart)
}

export function resolveRealtimeBoundaryAnchorKeyV2(frame: KLineChartRenderFrameV2) {
  return frame.segments.realtime
    ? `${frame.symbol}:${frame.period}:${frame.segments.realtime.timeFrom ?? 'none'}`
    : ''
}

export function resolveKLineChartViewportScopeV2(frame: KLineChartRenderFrameV2) {
  return `page:${frame.pageIndex}:${frame.segments.realtime ? 'visual-realtime' : 'history'}`
}

export function createKLineChartRenderStateControllerV2(
  chart: Chart,
  getViewportState: () => ViewportStateHandle | null,
) {
  let anchoredRealtimeBoundaryKey = ''
  let viewportContextKey = ''
  let viewportReady = false

  function resetViewportContextIfNeeded(frame: KLineChartRenderFrameV2) {
    const nextKey = `${frame.symbol}:${frame.period}:${resolveKLineChartViewportScopeV2(frame)}`
    if (viewportContextKey === nextKey) return
    viewportContextKey = nextKey
    viewportReady = false
  }

  function shouldAnchorRealtimeBoundary(frame: KLineChartRenderFrameV2) {
    const realtimeBoundaryKey = resolveRealtimeBoundaryAnchorKeyV2(frame)
    const shouldAnchor = kLineChartMainContainerSettingsV2.anchorRealtimeBoundaryOnFrameLoad &&
      Boolean(realtimeBoundaryKey) &&
      (frame.segments.realtime?.rows ?? 0) > 0 &&
      anchoredRealtimeBoundaryKey !== realtimeBoundaryKey
    if (shouldAnchor) anchoredRealtimeBoundaryKey = realtimeBoundaryKey
    return shouldAnchor
  }

  function restoreDynamicState(frame: KLineChartRenderFrameV2, options: { restoreHorizontal: boolean }) {
    const viewportState = getViewportState()
    if (viewportReady) {
      const restoredYAxis = kLineChartMainContainerSettingsV2.restoreYAxisOnRefresh
        ? restoreKLineChartYAxisAfterDataReadyV2(chart, frame.symbol, frame.period)
        : false
      if (!kLineChartMainContainerSettingsV2.restoreYAxisOnRefresh) resetKLineChartYAxisToAutoV2(chart)
      viewportState?.markReadyAfterRestore()
      return restoredYAxis
    }
    const restoredHorizontal = options.restoreHorizontal
      ? restoreKLineChartViewportStateV2(chart, frame.symbol, frame.period, {
        allowOffsetRightDistance: Boolean(frame.segments.realtime),
        viewportScope: resolveKLineChartViewportScopeV2(frame),
      })
      : false
    const restoredYAxis = kLineChartMainContainerSettingsV2.restoreYAxisOnRefresh
      ? restoreKLineChartYAxisAfterDataReadyV2(chart, frame.symbol, frame.period)
      : false
    if (!kLineChartMainContainerSettingsV2.restoreYAxisOnRefresh) resetKLineChartYAxisToAutoV2(chart)
    viewportReady = true
    viewportState?.markReadyAfterRestore()
    return restoredHorizontal || restoredYAxis
  }

  return {
    beginFrameRestore(frame: KLineChartRenderFrameV2, options: {
      pageJumpMovement?: KLineChartPageJumpMovementV2 | null
      sameRenderWindow: boolean
    }): KLineChartFrameRestorePlanV2 {
      resetViewportContextIfNeeded(frame)
      const anchorRealtimeBoundary = shouldAnchorRealtimeBoundary(frame)
      getViewportState()?.markRestoring()
      const shouldRestoreViewport = kLineChartMainContainerSettingsV2.restoreHorizontalViewportOnRefresh && !options.pageJumpMovement
      return {
        anchorRealtimeBoundary,
        preserveVisibleRange: options.sameRenderWindow && !anchorRealtimeBoundary && !options.pageJumpMovement,
        restoreViewport: () => restoreDynamicState(frame, { restoreHorizontal: shouldRestoreViewport }),
      }
    },
    handleDataReady() {
      chart.resize()
    },
  }
}
