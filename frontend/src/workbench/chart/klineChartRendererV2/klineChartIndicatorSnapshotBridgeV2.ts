import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import { createIndicatorPageKey, createIndicatorSettingsHash } from '../indicatorPageSnapshotStore'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

export function createKLineChartIndicatorSnapshotContextV2(options: {
  frame: KLineChartRenderFrameV2
  indicatorId: string
  pane: KLineChartPaneFrame
  settingsHashInput?: unknown
}) {
  const { frame, indicatorId, pane } = options
  const pageKey = createIndicatorPageKey({
    pageIdentity: `${frame.key}:${pane.key}:${indicatorId}`,
    pageIndex: frame.pageIndex,
    period: frame.period,
    realtime: Boolean(frame.segments.realtime),
    rows: frame.mainRows,
    symbol: frame.symbol,
  })
  const settingsHash = createIndicatorSettingsHash(options.settingsHashInput ?? {
    indicator: indicatorId,
    period: frame.period,
    settings: pane.settings ?? null,
    symbol: frame.symbol,
  })
  return { pageKey, settingsHash }
}

export function createKLineChartRuntimeCalcParamsV2(options: {
  frame: KLineChartRenderFrameV2
  pageKey: string
  pane: KLineChartPaneFrame
  settingsHash: string
}) {
  return {
    ...(options.pane.settings && typeof options.pane.settings === 'object' ? options.pane.settings : {}),
    pageKey: options.pageKey,
    period: options.frame.period,
    runtimeOnly: true,
    settingsHash: options.settingsHash,
    symbol: options.frame.symbol,
  }
}
