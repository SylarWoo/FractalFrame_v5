import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorPageKey,
  createIndicatorSettingsHash,
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

const candlePaneId = 'candle_pane'

function findVwapPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6VwapIndicatorIdV2] ?? frame.panes.vwap ?? frame.panes.Vwap ?? null
}

function createSnapshotContext(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const pageKey = createIndicatorPageKey({
    pageIdentity: `${frame.key}:${pane.key}:${storeV6VwapIndicatorIdV2}`,
    pageIndex: frame.pageIndex,
    period: frame.period,
    realtime: Boolean(frame.segments.realtime),
    rows: frame.mainRows,
    symbol: frame.symbol,
  })
  const settingsHash = createIndicatorSettingsHash({
    indicator: storeV6VwapIndicatorIdV2,
    period: frame.period,
    settings: pane.settings ?? null,
    symbol: frame.symbol,
  })
  return { pageKey, settingsHash }
}

function cloneVwapRows(rows: unknown[]): VwapIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as VwapIndicatorRow) } : {}
  ))
}

function writeVwapSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createSnapshotContext(frame, pane)
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
  return {
    ...(pane.settings && typeof pane.settings === 'object' ? pane.settings : {}),
    pageKey,
    period: frame.period,
    runtimeOnly: true,
    settingsHash,
    symbol: frame.symbol,
  }
}

export function installKLineChartMainVwapOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  let enabled = false
  ensureTradingViewVwapIndicator()

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findVwapPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      if (enabled) {
        chart.removeIndicator(candlePaneId, tradingViewVwapIndicatorName)
        enabled = false
      }
      return
    }
    const calcParams = [writeVwapSnapshot(nextFrame, pane)]
    if (chart.getIndicatorByPaneId(candlePaneId, tradingViewVwapIndicatorName)) {
      chart.overrideIndicator({ name: tradingViewVwapIndicatorName, calcParams }, candlePaneId)
    } else {
      chart.createIndicator({ name: tradingViewVwapIndicatorName, calcParams }, true, { id: candlePaneId })
    }
    enabled = true
  }

  apply(frame)

  return {
    destroy: () => {
      if (enabled) chart.removeIndicator(candlePaneId, tradingViewVwapIndicatorName)
      enabled = false
    },
    updateFrame: apply,
  }
}
