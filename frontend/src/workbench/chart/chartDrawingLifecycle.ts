import { ActionType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingToolCommandEvent } from '../rightDrawer/drawingToolCommands'
import { objectTreeDrawingCommandEvent, objectTreeDrawingsRequestEvent } from '../rightDrawer/objectTree/objectTreeModel'
import { visibilityRangeChangedEvent } from '../visibilityRange/visibilityRangeModel'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingVisibilityEvents'

export function installChartDrawingLifecycle({
  chart,
  handleCommand,
  handleDataReady,
  handleObjectTreeCommand,
  handleObjectTreeDrawingsRequest,
  handleStorage,
  handleVisibilityRangeChanged,
  handleVisibilityRefresh,
}: {
  chart: Chart
  handleCommand: (event: Event) => void
  handleDataReady: () => void
  handleObjectTreeCommand: (event: Event) => void
  handleObjectTreeDrawingsRequest: () => void
  handleStorage: (event: StorageEvent) => void
  handleVisibilityRangeChanged: (event: Event) => void
  handleVisibilityRefresh: () => void
}) {
  window.addEventListener(drawingToolCommandEvent, handleCommand)
  window.addEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
  window.addEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
  window.addEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
  window.addEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
  window.addEventListener('storage', handleStorage)
  chart.subscribeAction(ActionType.OnDataReady, handleDataReady)

  return () => {
    window.removeEventListener(drawingToolCommandEvent, handleCommand)
    window.removeEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
    window.removeEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
    window.removeEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
    window.removeEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
    window.removeEventListener('storage', handleStorage)
    chart.unsubscribeAction(ActionType.OnDataReady, handleDataReady)
  }
}
