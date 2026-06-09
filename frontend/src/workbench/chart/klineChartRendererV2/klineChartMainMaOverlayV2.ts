import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import { createIndicatorPageKey, createIndicatorSettingsHash, createIndicatorSnapshotRows, writeIndicatorPageSnapshot } from '../indicatorPageSnapshotStore'
import { storeV6MaIndicatorIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewMaShiftIndicator } from '../tradingViewMaShiftIndicator'
import type { MaShiftRow } from '../tradingViewMaShiftIndicator'

const candlePaneId = 'candle_pane'
const disconnectedRealtimeGapMs = 6 * 60 * 60 * 1000

function findMaPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6MaIndicatorIdV2] ?? frame.panes.Ma ?? frame.panes.ma ?? null
}

function cloneMaRows(rows: unknown[]): MaShiftRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as MaShiftRow) } : {}
  ))
}

export function markMainMaRowsBreakBeforeRealtimeGapV2(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame): MaShiftRow[] {
  const rows = cloneMaRows(pane.rows)
  const realtimeSegment = frame.segments.realtime
  if (!realtimeSegment || realtimeSegment.rows <= 0 || realtimeSegment.fromIndex <= 0) return rows
  const previous = frame.mainRows[realtimeSegment.fromIndex - 1]
  const current = frame.mainRows[realtimeSegment.fromIndex]
  const previousTimestamp = Number(previous?.timestamp)
  const currentTimestamp = Number(current?.timestamp)
  if (
    Number.isFinite(previousTimestamp) &&
    Number.isFinite(currentTimestamp) &&
    currentTimestamp - previousTimestamp > disconnectedRealtimeGapMs
  ) {
    rows[realtimeSegment.fromIndex] = {
      ...(rows[realtimeSegment.fromIndex] ?? {}),
      breakBefore: true,
    }
  }
  return rows
}

function createSnapshotContext(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const pageKey = createIndicatorPageKey({
    pageIdentity: `${frame.key}:${pane.key}:${storeV6MaIndicatorIdV2}`,
    pageIndex: frame.pageIndex,
    period: frame.period,
    realtime: Boolean(frame.segments.realtime),
    rows: frame.mainRows,
    symbol: frame.symbol,
  })
  const settingsHash = createIndicatorSettingsHash({
    indicator: storeV6MaIndicatorIdV2,
    period: frame.period,
    settings: pane.settings ?? null,
    symbol: frame.symbol,
  })
  return { pageKey, settingsHash }
}

function writeMaSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createSnapshotContext(frame, pane)
  const maRows = markMainMaRowsBreakBeforeRealtimeGapV2(frame, pane)
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      maRows,
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
    }),
    settingsHash,
    settingsHashKey: storeV6MaIndicatorIdV2,
    symbol: frame.symbol,
  })
  return {
    ...(pane.settings && typeof pane.settings === 'object' ? pane.settings : {}),
    pageKey,
    period: frame.period,
    runtimeOnly: true,
    settingsHash,
    symbol: frame.symbol,
  }
}

export function installKLineChartMainMaOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  let enabled = false
  ensureTradingViewMaShiftIndicator()

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findMaPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      if (enabled) {
        chart.removeIndicator(candlePaneId, storeV6MaIndicatorIdV2)
        enabled = false
      }
      return
    }
    const calcParams = [writeMaSnapshot(nextFrame, pane)]
    if (chart.getIndicatorByPaneId(candlePaneId, storeV6MaIndicatorIdV2)) {
      chart.overrideIndicator({ name: storeV6MaIndicatorIdV2, calcParams }, candlePaneId)
    } else {
      chart.createIndicator({ name: storeV6MaIndicatorIdV2, calcParams }, true, { id: candlePaneId })
    }
    enabled = true
  }

  apply(frame)

  return {
    destroy: () => {
      if (enabled) chart.removeIndicator(candlePaneId, storeV6MaIndicatorIdV2)
      enabled = false
    },
    updateFrame: apply,
  }
}
