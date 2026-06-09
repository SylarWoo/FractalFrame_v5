import type { Chart } from 'klinecharts'

type IndicatorCreateConfigV2 = Exclude<Parameters<Chart['createIndicator']>[0], string>
type IndicatorCreatePaneOptionsV2 = NonNullable<Parameters<Chart['createIndicator']>[2]>

export function createKLineChartIndicatorMountAdapterV2(options: {
  chart: Chart
  createPaneOptions?: () => IndicatorCreatePaneOptionsV2
  createStack?: boolean
  indicatorName: string
  onBeforeRemove?: () => void
  paneId: string
}) {
  let enabled = false
  const { chart, indicatorName, paneId } = options

  const hasIndicator = () => Boolean(chart.getIndicatorByPaneId(paneId, indicatorName))

  const remove = () => {
    if (!enabled && !hasIndicator()) return
    options.onBeforeRemove?.()
    chart.removeIndicator(paneId, indicatorName)
    enabled = false
  }

  return {
    apply(indicator: IndicatorCreateConfigV2) {
      if (hasIndicator()) {
        chart.overrideIndicator(indicator, paneId)
      } else {
        chart.createIndicator(indicator, Boolean(options.createStack), options.createPaneOptions?.() ?? { id: paneId })
      }
      enabled = true
    },
    destroy: remove,
    remove,
  }
}
