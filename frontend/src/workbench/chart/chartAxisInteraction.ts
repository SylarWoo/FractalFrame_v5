import type { Chart } from 'klinecharts'

type ChartWithDrawPaneAccess = Chart & {
  getDrawPaneById?: (paneId: string) => {
    getAxisComponent?: () => {
      setAutoCalcTickFlag?: (flag: boolean) => void
    }
  } | null
}

export const chartYAxisUnlockPaneIds = ['candle_pane']

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
