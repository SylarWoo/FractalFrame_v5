import type { Chart } from 'klinecharts'
import { storeV6MmfStochH2IndicatorIdV2, storeV6MmfStochH2PaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import {
  ensureTradingViewMmfStochH2Indicator,
  tradingViewMmfStochH2IndicatorName,
  type MmfStochH2IndicatorRow,
} from '../tradingViewMmfStochH2Indicator'
import { createKLineChartIndicatorMountAdapterV2 } from './klineChartIndicatorMountAdapterV2'

const mmfStochH2IndicatorZLevel = 32

function findMmfStochH2Pane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6MmfStochH2IndicatorIdV2] ?? frame.panes.mmfStochH2 ?? null
}

function cloneRows(rows: unknown[]): MmfStochH2IndicatorRow[] {
  return rows.map((row) => (row && typeof row === 'object' ? { ...(row as MmfStochH2IndicatorRow) } : {}))
}

export function installKLineChartMainMmfStochH2OverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  ensureTradingViewMmfStochH2Indicator()
  const mount = createKLineChartIndicatorMountAdapterV2({
    chart,
    createStack: true,
    indicatorName: tradingViewMmfStochH2IndicatorName,
    paneId: storeV6MmfStochH2PaneIdV2,
  })

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findMmfStochH2Pane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      mount.remove()
      return
    }
    const settings = pane.settings && typeof pane.settings === 'object'
      ? pane.settings as Record<string, unknown>
      : {}
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const eventStore = settings.eventStore && typeof settings.eventStore === 'object'
        ? settings.eventStore as { events?: unknown[] }
        : null
      ;(window as typeof window & {
        __ffMmfStochH2EventReceiver?: Record<string, unknown>
      }).__ffMmfStochH2EventReceiver = {
        eventCount: Array.isArray(eventStore?.events) ? eventStore.events.length : 0,
        eventStore,
        paneRows: Array.isArray(pane.rows) ? pane.rows.length : 0,
        period: nextFrame.period,
        symbol: nextFrame.symbol,
      }
    }
    mount.apply({
      name: tradingViewMmfStochH2IndicatorName,
      calcParams: [{
        ...(settings.settings && typeof settings.settings === 'object' ? { settings: settings.settings } : {}),
        period: nextFrame.period,
        staticRows: cloneRows(pane.rows),
        symbol: nextFrame.symbol,
      }],
      zLevel: mmfStochH2IndicatorZLevel,
    })
  }

  apply(frame)

  return {
    destroy: mount.destroy,
    updateFrame: apply,
  }
}
