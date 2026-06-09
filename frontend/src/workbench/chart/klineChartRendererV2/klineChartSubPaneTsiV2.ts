import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6TsiIndicatorIdV2, storeV6TsiPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewTsiIndicator, type TsiIndicatorRow } from '../tradingViewTsiIndicator'
import {
  kLineChartSubPaneMinHeightV2,
  readKLineChartSubPaneHeightV2,
  writeKLineChartSubPaneHeightV2,
} from './klineChartSubPaneHeightLifecycleV2'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const tsiPaneHeightStorageKey = 'fractalframe.chart.tsiPaneHeight'

function findTsiPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6TsiIndicatorIdV2] ?? frame.panes.tsi ?? null
}

function cloneTsiRows(rows: unknown[]): TsiIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as TsiIndicatorRow) } : {}
  ))
}

function writeTsiSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6TsiIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
      tsiRows: cloneTsiRows(pane.rows),
    }),
    settingsHash,
    settingsHashKey: storeV6TsiIndicatorIdV2,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartSubPaneTsiV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewTsiIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createPaneOptions: () => ({ id: storeV6TsiPaneIdV2, height: readKLineChartSubPaneHeightV2(tsiPaneHeightStorageKey), minHeight: kLineChartSubPaneMinHeightV2 }),
    indicatorName: storeV6TsiIndicatorIdV2,
    onBeforeRemove: () => writeKLineChartSubPaneHeightV2(chart, storeV6TsiPaneIdV2, tsiPaneHeightStorageKey),
    paneId: storeV6TsiPaneIdV2,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findTsiPane(nextFrame)
    if (!pane || pane.renderRole !== 'sub-pane') {
      mount.remove()
      return
    }
    const calcParams = [writeTsiSnapshot(nextFrame, pane)]
    mount.apply({ name: storeV6TsiIndicatorIdV2, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
