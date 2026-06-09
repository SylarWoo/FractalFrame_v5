import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6StochIndicatorIdV2, storeV6StochPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewStochIndicator, type StochIndicatorRow } from '../tradingViewStochIndicator'
import {
  kLineChartSubPaneMinHeightV2,
  readKLineChartSubPaneHeightV2,
  writeKLineChartSubPaneHeightV2,
} from './klineChartSubPaneHeightLifecycleV2'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const stochPaneHeightStorageKey = 'fractalframe.chart.stochPaneHeight'

function findStochPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6StochIndicatorIdV2] ?? frame.panes.STOCH ?? frame.panes.stoch ?? null
}

function cloneStochRows(rows: unknown[]): StochIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as StochIndicatorRow) } : {}
  ))
}

function writeStochSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6StochIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      stochRows: cloneStochRows(pane.rows),
      symbol: frame.symbol,
    }),
    settingsHash,
    settingsHashKey: storeV6StochIndicatorIdV2,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartSubPaneStochV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewStochIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createPaneOptions: () => ({ id: storeV6StochPaneIdV2, height: readKLineChartSubPaneHeightV2(stochPaneHeightStorageKey), minHeight: kLineChartSubPaneMinHeightV2 }),
    indicatorName: storeV6StochIndicatorIdV2,
    onBeforeRemove: () => writeKLineChartSubPaneHeightV2(chart, storeV6StochPaneIdV2, stochPaneHeightStorageKey),
    paneId: storeV6StochPaneIdV2,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findStochPane(nextFrame)
    if (!pane || pane.renderRole !== 'sub-pane') {
      mount.remove()
      return
    }
    const calcParams = [writeStochSnapshot(nextFrame, pane)]
    mount.apply({ name: storeV6StochIndicatorIdV2, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
