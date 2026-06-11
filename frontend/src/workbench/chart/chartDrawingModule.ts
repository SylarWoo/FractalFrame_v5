import type { Chart } from 'klinecharts'
import { chartDrawingVisibilityRefreshEvent, installChartDrawingTools } from './chartDrawingTools'

export type ChartDrawingModuleContext = {
  period: string
  symbol: string
  viewportScope?: string
}

export type ChartDrawingModule = {
  destroy: () => void
  refreshVisibility: () => void
  updateContext: (context: ChartDrawingModuleContext) => void
}

function dispatchDrawingVisibilityRefresh() {
  window.dispatchEvent(new Event(chartDrawingVisibilityRefreshEvent))
}

export function installChartDrawingModule(options: {
  chart: Chart
  initialContext: ChartDrawingModuleContext
}): ChartDrawingModule {
  let context = options.initialContext
  const cleanupDrawingTools = installChartDrawingTools(options.chart, () => context.period)

  const refreshVisibility = () => {
    dispatchDrawingVisibilityRefresh()
    window.requestAnimationFrame(dispatchDrawingVisibilityRefresh)
  }

  refreshVisibility()

  return {
    destroy: cleanupDrawingTools,
    refreshVisibility,
    updateContext: (nextContext) => {
      const changed = context.period !== nextContext.period ||
        context.symbol !== nextContext.symbol ||
        context.viewportScope !== nextContext.viewportScope
      context = nextContext
      if (changed) refreshVisibility()
    },
  }
}
