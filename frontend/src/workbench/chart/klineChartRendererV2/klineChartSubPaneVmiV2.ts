import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6VmiIndicatorIdV2, storeV6VmiPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewVmiIndicator, type VmiIndicatorRow } from '../tradingViewVmiIndicator'
import {
  kLineChartSubPaneMinHeightV2,
  readKLineChartSubPaneHeightV2,
  writeKLineChartSubPaneHeightV2,
} from './klineChartSubPaneHeightLifecycleV2'
import { createKLineChartIndicatorSnapshotContextV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const vmiPaneHeightStorageKey = 'fractalframe.chart.vmiPaneHeight'

function findVmiPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6VmiIndicatorIdV2] ?? frame.panes.vmi ?? null
}

function cloneVmiRows(rows: unknown[]): VmiIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as VmiIndicatorRow) } : {}
  ))
}

function writeVmiSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6VmiIndicatorIdV2,
    pane,
  })
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
      vmiRows: cloneVmiRows(pane.rows),
    }),
    settingsHash,
    settingsHashKey: storeV6VmiIndicatorIdV2,
    symbol: frame.symbol,
  })
  return {
    pageKey,
    period: frame.period,
    runtimeOnly: true,
    settings: pane.settings && typeof pane.settings === 'object' ? pane.settings : {},
    settingsHash,
    symbol: frame.symbol,
  }
}

export function installKLineChartSubPaneVmiV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewVmiIndicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createPaneOptions: () => ({ id: storeV6VmiPaneIdV2, height: readKLineChartSubPaneHeightV2(vmiPaneHeightStorageKey), minHeight: kLineChartSubPaneMinHeightV2 }),
    indicatorName: storeV6VmiIndicatorIdV2,
    onBeforeRemove: () => writeKLineChartSubPaneHeightV2(chart, storeV6VmiPaneIdV2, vmiPaneHeightStorageKey),
    paneId: storeV6VmiPaneIdV2,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findVmiPane(nextFrame)
    if (!pane || pane.renderRole !== 'sub-pane') {
      mount.remove()
      return
    }
    const calcParams = [writeVmiSnapshot(nextFrame, pane)]
    mount.apply({ name: storeV6VmiIndicatorIdV2, calcParams })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
