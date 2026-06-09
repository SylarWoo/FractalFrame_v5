import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import {
  storeV6MorganRangeM5IndicatorIdV2,
  storeV6MorganRangeM30IndicatorIdV2,
} from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { MorganRangeMode, MorganRangeSegment } from '../morganRangeModel'
import { ensureTradingViewMrIndicator } from '../tradingViewMrIndicator'
import { createKLineChartIndicatorSnapshotContextV2 } from './klineChartIndicatorSnapshotBridgeV2'

const candlePaneId = 'candle_pane'

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
  const normalizedPeriod = frame.period.trim().toUpperCase()
  const m30Pane = frame.panes[storeV6MorganRangeM30IndicatorIdV2] ?? frame.panes['MR-M30'] ?? null
  const m5Pane = frame.panes[storeV6MorganRangeM5IndicatorIdV2] ?? frame.panes['MR-M5'] ?? null
  if (normalizedPeriod === 'M5' && m5Pane) {
    return {
      indicatorId: storeV6MorganRangeM5IndicatorIdV2,
      mode: 'H4_M5',
      pane: m5Pane,
      settingsHashKey: storeV6MorganRangeM5IndicatorIdV2,
    }
  }
  if (normalizedPeriod === 'M30' && m30Pane) {
    return {
      indicatorId: storeV6MorganRangeM30IndicatorIdV2,
      mode: 'D1_M30',
      pane: m30Pane,
      settingsHashKey: storeV6MorganRangeM30IndicatorIdV2,
    }
  }
  if (!m5Pane && !m30Pane) return null
  if (m30Pane) {
    return {
      indicatorId: storeV6MorganRangeM30IndicatorIdV2,
      mode: 'D1_M30',
      pane: m30Pane,
      settingsHashKey: storeV6MorganRangeM30IndicatorIdV2,
    }
  }
  if (!m5Pane) return null
  return {
    indicatorId: storeV6MorganRangeM5IndicatorIdV2,
    mode: 'H4_M5',
    pane: m5Pane,
    settingsHashKey: storeV6MorganRangeM5IndicatorIdV2,
  }
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

function writeMorganRangeSnapshot(frame: KLineChartRenderFrameV2, target: MorganRangePaneTarget) {
  const segments = target.pane.rows.filter(isMorganRangeSegment)
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
  let enabled = false
  let enabledIndicatorId: string | null = null
  ensureTradingViewMrIndicator(storeV6MorganRangeM5IndicatorIdV2)
  ensureTradingViewMrIndicator(storeV6MorganRangeM30IndicatorIdV2)

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const target = findMorganRangePane(nextFrame)
    if (!target || target.pane.renderRole !== 'main-overlay') {
      if (enabled && enabledIndicatorId) {
        chart.removeIndicator(candlePaneId, enabledIndicatorId)
        enabled = false
        enabledIndicatorId = null
      }
      return
    }
    if (enabledIndicatorId && enabledIndicatorId !== target.indicatorId) {
      chart.removeIndicator(candlePaneId, enabledIndicatorId)
      enabled = false
      enabledIndicatorId = null
    }
    const calcParams = [writeMorganRangeSnapshot(nextFrame, target)]
    if (chart.getIndicatorByPaneId(candlePaneId, target.indicatorId)) {
      chart.overrideIndicator({ name: target.indicatorId, calcParams }, candlePaneId)
    } else {
      chart.createIndicator({ name: target.indicatorId, calcParams }, true, { id: candlePaneId })
    }
    enabled = true
    enabledIndicatorId = target.indicatorId
  }

  apply(frame)

  return {
    destroy: () => {
      if (enabled && enabledIndicatorId) chart.removeIndicator(candlePaneId, enabledIndicatorId)
      enabled = false
      enabledIndicatorId = null
    },
    scheduleGeometryRefresh() {
      // MR now renders inside klinecharts' indicator lifecycle, so y-axis/x-axis changes are handled by the chart.
    },
    updateFrame: apply,
  }
}
