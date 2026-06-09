import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import { createIndicatorSnapshotRows, writeIndicatorPageSnapshot } from '../indicatorPageSnapshotStore'
import { storeV6MaIndicatorIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewMaShiftIndicator } from '../tradingViewMaShiftIndicator'
import type { MaShiftRow } from '../tradingViewMaShiftIndicator'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

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

function writeMaSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6MaIndicatorIdV2,
    pane,
  })
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
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartMainMaOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewMaShiftIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createStack: true,
    indicatorName: storeV6MaIndicatorIdV2,
    paneId: candlePaneId,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findMaPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      mount.remove()
      return
    }
    const calcParams = [writeMaSnapshot(nextFrame, pane)]
    mount.apply({ name: storeV6MaIndicatorIdV2, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
