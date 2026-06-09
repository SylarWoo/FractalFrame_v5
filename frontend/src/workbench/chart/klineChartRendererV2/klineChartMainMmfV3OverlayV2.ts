import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6MmfV3IndicatorIdV2, storeV6MmfV3PaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { MmfV3CalcContext, MmfV3IndicatorRow } from '../mmfV3Types'
import { ensureTradingViewMmfV3Indicator } from '../tradingViewMmfV3Indicator'
import { createKLineChartIndicatorSnapshotContextV2 } from './klineChartIndicatorSnapshotBridgeV2'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const mmfV3IndicatorZLevel = 30

function findMmfV3Pane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6MmfV3IndicatorIdV2] ?? frame.panes.mmfV3 ?? null
}

function cloneMmfV3Rows(rows: unknown[]): MmfV3IndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as MmfV3IndicatorRow) } : {}
  ))
}

function createSnapshotContext(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const settings = pane.settings && typeof pane.settings === 'object'
    ? pane.settings as MmfV3CalcContext
    : {}
  const { pageKey, settingsHash } = createKLineChartIndicatorSnapshotContextV2({
    frame,
    indicatorId: storeV6MmfV3IndicatorIdV2,
    pane,
    settingsHashInput: {
      indicator: storeV6MmfV3IndicatorIdV2,
      maSettings: settings.maSettings,
      mmfSettings: settings.settings,
      morganRangeMode: settings.morganRangeMode,
      period: frame.period,
      stochSettings: settings.stochSettings,
      symbol: frame.symbol,
      tsiSettings: settings.tsiSettings,
      vdoSettings: settings.vdoSettings,
      vmiSettings: settings.vmiSettings,
      vwapSettings: settings.vwapSettings,
    },
  })
  return { pageKey, settings, settingsHash }
}

function writeMmfV3Snapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settings, settingsHash } = createSnapshotContext(frame, pane)
  writeIndicatorPageSnapshot({
    pageKey,
    period: frame.period,
    rows: createIndicatorSnapshotRows({
      mmfV3Rows: cloneMmfV3Rows(pane.rows),
      period: frame.period,
      rows: frame.mainRows,
      symbol: frame.symbol,
    }),
    settingsHash,
    settingsHashKey: storeV6MmfV3IndicatorIdV2,
    symbol: frame.symbol,
  })
  return {
    ...settings,
    pageKey,
    period: frame.period,
    settingsHash,
    symbol: frame.symbol,
  }
}

export function installKLineChartMainMmfV3OverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewMmfV3Indicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createStack: true,
    indicatorName: storeV6MmfV3IndicatorIdV2,
    paneId: storeV6MmfV3PaneIdV2,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findMmfV3Pane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      mount.remove()
      return
    }
    const calcParams = [writeMmfV3Snapshot(nextFrame, pane)]
    mount.apply({ name: storeV6MmfV3IndicatorIdV2, calcParams, zLevel: mmfV3IndicatorZLevel })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
