import { isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import type { DrawingToolCommand } from '../rightDrawer/drawingToolCommands'

export type ChartDrawingCommandRouterOptions = {
  handleFibCommand: (command: DrawingToolCommand) => void
  handleHorizontalLineCommand: (command: DrawingToolCommand) => void
  handleRulerCommand: (command: DrawingToolCommand) => void
  handleTrendLineCommand: (command: DrawingToolCommand) => void
  releaseMorganRange: () => void
  setQuickMeasureEnabled: (enabled: boolean) => void
  startMorganRange: () => void
}

export function routeChartDrawingCommand(event: Event, options: ChartDrawingCommandRouterOptions) {
  if (!isDrawingToolCommandEvent(event)) return
  if (event.detail.tool === 'morganRange') {
    if (event.detail.action === 'start') options.startMorganRange()
    if (event.detail.action === 'release') options.releaseMorganRange()
    publishDrawingToolState({
      armed: event.detail.action === 'start',
      locked: true,
      selected: false,
      showPriceLabel: false,
      tool: 'morganRange',
    })
    return
  }
  if (event.detail.tool === 'ruler' && event.detail.action === 'updateQuickMeasureEnabled') {
    options.setQuickMeasureEnabled(event.detail.enabled === true)
    return
  }
  if (event.detail.tool === 'trendLine') options.handleTrendLineCommand(event.detail)
  else if (event.detail.tool === 'ruler') options.handleRulerCommand(event.detail)
  else if (event.detail.tool === 'fibRetracement') options.handleFibCommand(event.detail)
  else options.handleHorizontalLineCommand(event.detail)
}
