import type { Chart } from 'klinecharts'
import { storeV6MorganRangeM5IndicatorIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { MorganRangeSegment } from '../morganRangeModel'
import { applyMorganRangeOverlaySegments, clearMorganRangeOverlays } from '../useMorganRangeOverlays'

function findMorganRangeM5Pane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6MorganRangeM5IndicatorIdV2] ?? frame.panes['MR-M5'] ?? null
}

function isMorganRangeSegment(row: unknown): row is MorganRangeSegment {
  if (!row || typeof row !== 'object') return false
  const segment = row as Partial<MorganRangeSegment>
  return Number.isFinite(segment.startIndex) &&
    Number.isFinite(segment.endIndex) &&
    Number.isFinite(segment.startTimestamp) &&
    Number.isFinite(segment.center) &&
    Number.isFinite(segment.upper) &&
    Number.isFinite(segment.lower)
}

export function installKLineChartMainMorganRangeOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  const overlayIds = new Set<string>()

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findMorganRangeM5Pane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      clearMorganRangeOverlays(chart, overlayIds)
      return
    }
    const segments = pane.rows.filter(isMorganRangeSegment)
    applyMorganRangeOverlaySegments(chart, nextFrame.period, overlayIds, 'H4_M5', segments)
  }

  apply(frame)

  return {
    destroy: () => clearMorganRangeOverlays(chart, overlayIds),
    updateFrame: apply,
  }
}
