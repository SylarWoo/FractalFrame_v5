import type { Chart } from 'klinecharts'

type ChartWithDrawPaneAccess = Chart & {
  adjustPaneViewport?: (shouldMeasureHeight?: boolean, shouldMeasureWidth?: boolean, shouldUpdate?: boolean, shouldAdjustYAxis?: boolean, shouldForceAdjustYAxis?: boolean) => void
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      setAutoCalcTickFlag?: (flag: boolean) => void
    }
  } | null
}

export const chartYAxisUnlockPaneIds = ['candle_pane']
export const indicatorYAxisAutoScalePaneIds = ['rsi_pane', 'stoch_pane', 'macd_pane', 'tsi_pane', 'vi_pane']

export function unlockYAxisManualDrag(chart: Chart, paneIds: string[] = chartYAxisUnlockPaneIds) {
  const chartWithDrawPaneAccess = chart as ChartWithDrawPaneAccess

  paneIds.forEach((paneId) => {
    const yAxis = chartWithDrawPaneAccess.getDrawPaneById?.(paneId)?.getAxisComponent?.()
    yAxis?.setAutoCalcTickFlag?.(false)
  })
}

export function scheduleUnlockYAxisManualDrag(chart: Chart, paneIds?: string[]) {
  window.requestAnimationFrame(() => unlockYAxisManualDrag(chart, paneIds))
}

export function resetIndicatorYAxisAutoScale(chart: Chart, paneIds: string[] = indicatorYAxisAutoScalePaneIds) {
  const chartWithDrawPaneAccess = chart as ChartWithDrawPaneAccess

  paneIds.forEach((paneId) => {
    const yAxis = chartWithDrawPaneAccess.getDrawPaneById?.(paneId)?.getAxisComponent?.()
    yAxis?.setAutoCalcTickFlag?.(true)
  })
  chartWithDrawPaneAccess.adjustPaneViewport?.(false, true, true, true, true)
}

export function scheduleResetIndicatorYAxisAutoScale(chart: Chart, paneIds?: string[]) {
  window.requestAnimationFrame(() => resetIndicatorYAxisAutoScale(chart, paneIds))
}
