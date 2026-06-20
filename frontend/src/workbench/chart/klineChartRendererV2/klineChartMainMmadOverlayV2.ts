import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import { createIndicatorSnapshotRows, writeIndicatorPageSnapshot } from '../indicatorPageSnapshotStore'
import { storeV6MmadIndicatorIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewMmadIndicator, type MmadIndicatorRow } from '../tradingViewMmadIndicator'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const candlePaneId = 'candle_pane'
const tradingViewMmadIndicatorName = 'MMAD'

function findMmadPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6MmadIndicatorIdV2] ?? frame.panes.mmad ?? null
}

function cloneMmadRows(rows: unknown[]): MmadIndicatorRow[] {
  return rows.map((row) => (row && typeof row === 'object' ? { ...(row as MmadIndicatorRow) } : {}))
}

function writeMmadSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6MmadIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
      mmadRows: cloneMmadRows(pane.rows),
    }),
    settingsHash,
    settingsHashKey: storeV6MmadIndicatorIdV2,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartMainMmadOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewMmadIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createStack: true,
    indicatorName: tradingViewMmadIndicatorName,
    paneId: candlePaneId,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findMmadPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      mount.remove()
      return
    }
    const calcParams = [writeMmadSnapshot(nextFrame, pane)]
    mount.apply({ name: tradingViewMmadIndicatorName, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
