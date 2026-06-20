import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import {
  storeV6MorganRangeM5IndicatorIdV2,
  storeV6MorganRangeM30IndicatorIdV2,
  storeV6MorganRangeH2IndicatorIdV2,
} from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { MorganRangeMode, MorganRangeSegment } from '../morganRangeModel'
import {
  isMorganRangeSegmentV2,
  readMorganRangePaneFromFrameV2,
  resolveMorganRangeRuntimeDefinitionForFrameV2,
} from '../morganRangeRuntimeV2'
import { ensureTradingViewMrIndicator } from '../tradingViewMrIndicator'
import { createKLineChartIndicatorSnapshotContextV2 } from './klineChartIndicatorSnapshotBridgeV2'

const candlePaneId = 'candle_pane'
const morganRangeIndicatorIds = [
  storeV6MorganRangeM5IndicatorIdV2,
  storeV6MorganRangeM30IndicatorIdV2,
  storeV6MorganRangeH2IndicatorIdV2,
] as const

declare global {
  interface Window {
    __ffKLineChartV2MrDebug?: {
      frameKey: string
      pageKey: string
      realtimeFromIndex: number | null
      segments: Array<Pick<MorganRangeSegment, 'endIndex' | 'endTimestamp' | 'startIndex' | 'startTimestamp'>>
      totalSegments: number
    }
  }
}

type MorganRangePaneTarget = {
  indicatorId: string
  mode: MorganRangeMode
  pane: KLineChartPaneFrame
  settingsHashKey: string
}

function findMorganRangePane(frame: KLineChartRenderFrameV2): MorganRangePaneTarget | null {
  const definition = resolveMorganRangeRuntimeDefinitionForFrameV2(frame)
  if (!definition) return null
  const pane = readMorganRangePaneFromFrameV2(frame, definition)
  if (!pane) return null
  return {
    indicatorId: definition.indicatorId,
    mode: definition.mode,
    pane,
    settingsHashKey: definition.indicatorId,
  }
}

function writeMorganRangeSnapshot(frame: KLineChartRenderFrameV2, target: MorganRangePaneTarget) {
  const segments = target.pane.rows.filter(isMorganRangeSegmentV2)
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: target.indicatorId,
    pane: target.pane,
  })
  writeIndicatorPageSnapshot({
    morganRange: {
      mode: target.mode,
      segments,
    },
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
    }),
    settingsHash,
    settingsHashKey: target.settingsHashKey,
    symbol: frame.symbol,
  })
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.__ffKLineChartV2MrDebug = {
      frameKey: frame.key,
      pageKey,
      realtimeFromIndex: frame.segments.realtime?.fromIndex ?? null,
      segments: segments.slice(-8).map((segment) => ({
        endIndex: segment.endIndex,
        endTimestamp: segment.endTimestamp,
        startIndex: segment.startIndex,
        startTimestamp: segment.startTimestamp,
      })),
      totalSegments: segments.length,
    }
  }
  return {
    ...(target.pane.settings && typeof target.pane.settings === 'object' ? target.pane.settings : {}),
    pageKey,
    runtimeOnly: true,
    settingsHash,
    settingsHashKey: target.settingsHashKey,
  }
}

export function installKLineChartMainMorganRangeOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  let enabledIndicatorId: string | null = null
  ensureTradingViewMrIndicator(storeV6MorganRangeM5IndicatorIdV2)
  ensureTradingViewMrIndicator(storeV6MorganRangeM30IndicatorIdV2)
  ensureTradingViewMrIndicator(storeV6MorganRangeH2IndicatorIdV2)

  const removeInactiveMorganRangeIndicators = (activeIndicatorId: string | null = null) => {
    morganRangeIndicatorIds.forEach((indicatorId) => {
      if (indicatorId !== activeIndicatorId) chart.removeIndicator(candlePaneId, indicatorId)
    })
  }

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const target = findMorganRangePane(nextFrame)
    if (!target || target.pane.renderRole !== 'main-overlay') {
      removeInactiveMorganRangeIndicators(null)
      enabledIndicatorId = null
      return
    }
    removeInactiveMorganRangeIndicators(target.indicatorId)
    if (enabledIndicatorId && enabledIndicatorId !== target.indicatorId) {
      chart.removeIndicator(candlePaneId, enabledIndicatorId)
      enabledIndicatorId = null
    }
    const calcParams = [writeMorganRangeSnapshot(nextFrame, target)]
    if (chart.getIndicatorByPaneId(candlePaneId, target.indicatorId)) {
      chart.overrideIndicator({ name: target.indicatorId, calcParams }, candlePaneId)
    } else {
      chart.createIndicator({ name: target.indicatorId, calcParams }, true, { id: candlePaneId })
    }
    enabledIndicatorId = target.indicatorId
  }

  apply(frame)

  return {
    destroy: () => {
      removeInactiveMorganRangeIndicators(null)
      enabledIndicatorId = null
    },
    scheduleGeometryRefresh() {
      // MR now renders inside klinecharts' indicator lifecycle, so y-axis/x-axis changes are handled by the chart.
    },
    updateFrame: apply,
  }
}
