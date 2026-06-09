import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6VwapIndicatorIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  ensureTradingViewVwapIndicator,
  tradingViewVwapIndicatorName,
  type VwapIndicatorRow,
} from '../tradingViewVwapIndicator'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const candlePaneId = 'candle_pane'

function findVwapPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6VwapIndicatorIdV2] ?? frame.panes.vwap ?? frame.panes.Vwap ?? null
}

function cloneVwapRows(rows: unknown[]): VwapIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as VwapIndicatorRow) } : {}
  ))
}

function writeVwapSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6VwapIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
      vwapRows: cloneVwapRows(pane.rows),
    }),
    settingsHash,
    settingsHashKey: storeV6VwapIndicatorIdV2,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartMainVwapOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewVwapIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createStack: true,
    indicatorName: tradingViewVwapIndicatorName,
    paneId: candlePaneId,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findVwapPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      mount.remove()
      return
    }
    const calcParams = [writeVwapSnapshot(nextFrame, pane)]
    mount.apply({ name: tradingViewVwapIndicatorName, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
