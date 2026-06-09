import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6VdoIndicatorIdV2, storeV6VdoPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewVdoIndicator, type VdoIndicatorRow } from '../tradingViewVdoIndicator'
import {
  kLineChartSubPaneMinHeightV2,
  readKLineChartSubPaneHeightV2,
  writeKLineChartSubPaneHeightV2,
} from './klineChartSubPaneHeightLifecycleV2'
import { createKLineChartIndicatorSnapshotContextV2, createKLineChartRuntimeCalcParamsV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const vdoPaneHeightStorageKey = 'fractalframe.chart.vdoPaneHeight'

function findVdoPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6VdoIndicatorIdV2] ?? frame.panes.vdo ?? null
}

function cloneVdoRows(rows: unknown[]): VdoIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as VdoIndicatorRow) } : {}
  ))
}

function writeVdoSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6VdoIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
      vdoRows: cloneVdoRows(pane.rows),
    }),
    settingsHash,
    settingsHashKey: storeV6VdoIndicatorIdV2,
    symbol: frame.symbol,
  })
  return createKLineChartRuntimeCalcParamsV2({
    frame,
    pageKey,
    pane,
    settingsHash,
  })
}

export function installKLineChartSubPaneVdoV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewVdoIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createPaneOptions: () => ({ id: storeV6VdoPaneIdV2, height: readKLineChartSubPaneHeightV2(vdoPaneHeightStorageKey), minHeight: kLineChartSubPaneMinHeightV2 }),
    indicatorName: storeV6VdoIndicatorIdV2,
    onBeforeRemove: () => writeKLineChartSubPaneHeightV2(chart, storeV6VdoPaneIdV2, vdoPaneHeightStorageKey),
    paneId: storeV6VdoPaneIdV2,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findVdoPane(nextFrame)
    if (!pane || pane.renderRole !== 'sub-pane') {
      mount.remove()
      return
    }
    const calcParams = [writeVdoSnapshot(nextFrame, pane)]
    mount.apply({ name: storeV6VdoIndicatorIdV2, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
