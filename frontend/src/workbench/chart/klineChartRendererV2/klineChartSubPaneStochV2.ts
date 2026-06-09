import type { Chart } from 'klinecharts'
import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'
import {
  createIndicatorPageKey,
  createIndicatorSettingsHash,
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from '../indicatorPageSnapshotStore'
import { storeV6StochIndicatorIdV2, storeV6StochPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewStochIndicator, type StochIndicatorRow } from '../tradingViewStochIndicator'

const stochPaneHeightStorageKey = 'fractalframe.chart.stochPaneHeight'
const defaultStochPaneHeight = 120
const minStochPaneHeight = 80
const maxStoredStochPaneHeight = 360

function normalizePaneHeight(value: number) {
  return Math.max(minStochPaneHeight, Math.min(Math.round(value), maxStoredStochPaneHeight))
}

function readStoredPaneHeight() {
  if (typeof window === 'undefined') return defaultStochPaneHeight
  const stored = Number(window.localStorage.getItem(stochPaneHeightStorageKey))
  return Number.isFinite(stored) ? normalizePaneHeight(stored) : defaultStochPaneHeight
}

function writeStoredPaneHeight(chart: Chart) {
  if (typeof window === 'undefined') return
  const size = chart.getSize(storeV6StochPaneIdV2)
  if (!size?.height) return
  window.localStorage.setItem(stochPaneHeightStorageKey, String(normalizePaneHeight(size.height)))
}

function findStochPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6StochIndicatorIdV2] ?? frame.panes.STOCH ?? frame.panes.stoch ?? null
}

function createSnapshotContext(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const pageKey = createIndicatorPageKey({
    pageIdentity: `${frame.key}:${pane.key}:${storeV6StochIndicatorIdV2}`,
    pageIndex: frame.pageIndex,
    period: frame.period,
    realtime: Boolean(frame.segments.realtime),
    rows: frame.mainRows,
    symbol: frame.symbol,
  })
  const settingsHash = createIndicatorSettingsHash({
    indicator: storeV6StochIndicatorIdV2,
    period: frame.period,
    settings: pane.settings ?? null,
    symbol: frame.symbol,
  })
  return { pageKey, settingsHash }
}

function cloneStochRows(rows: unknown[]): StochIndicatorRow[] {
  return rows.map((row) => (
    row && typeof row === 'object' ? { ...(row as StochIndicatorRow) } : {}
  ))
}

function writeStochSnapshot(frame: KLineChartRenderFrameV2, pane: KLineChartPaneFrame) {
  const { pageKey, settingsHash } = createSnapshotContext(frame, pane)
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
  return {
    ...(pane.settings && typeof pane.settings === 'object' ? pane.settings : {}),
    pageKey,
    period: frame.period,
    runtimeOnly: true,
    settingsHash,
    symbol: frame.symbol,
  }
}

export function installKLineChartSubPaneStochV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  let enabled = false
  ensureTradingViewStochIndicator()

  const remove = () => {
    if (!enabled && !chart.getIndicatorByPaneId(storeV6StochPaneIdV2, storeV6StochIndicatorIdV2)) return
    writeStoredPaneHeight(chart)
    chart.removeIndicator(storeV6StochPaneIdV2, storeV6StochIndicatorIdV2)
    enabled = false
  }

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findStochPane(nextFrame)
    if (!pane || pane.renderRole !== 'sub-pane') {
      remove()
      return
    }
    const calcParams = [writeStochSnapshot(nextFrame, pane)]
    if (chart.getIndicatorByPaneId(storeV6StochPaneIdV2, storeV6StochIndicatorIdV2)) {
      chart.overrideIndicator({ name: storeV6StochIndicatorIdV2, calcParams }, storeV6StochPaneIdV2)
    } else {
      chart.createIndicator(
        { name: storeV6StochIndicatorIdV2, calcParams },
        false,
        { id: storeV6StochPaneIdV2, height: readStoredPaneHeight(), minHeight: minStochPaneHeight },
      )
    }
    enabled = true
  }

  apply(frame)

  return {
    destroy: remove,
    updateFrame: apply,
  }
}
