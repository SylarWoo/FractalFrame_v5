import { clearStoredFibRetracementDrawings } from '../rightDrawer/drawingObjectPersistence'
import { createRulerToolCommandHandler } from './chartRulerToolCommands'
import type { PendingRulerOptions } from './rulerOverlayController'

export type { PendingRulerOptions }

type FibDrawingToolOptions = Omit<
  Parameters<typeof createRulerToolCommandHandler>[0],
  | 'clearStoredDrawings'
  | 'getPendingRulerOptions'
  | 'getPendingRulerOverlayId'
  | 'getRulerPersistenceEnabled'
  | 'setPendingRulerOptions'
  | 'setPendingRulerOverlayId'
  | 'setRulerPersistenceEnabled'
  | 'tool'
> & {
  initialPersistenceEnabled: boolean
}

export function installFibRetracementDrawingTool(options: FibDrawingToolOptions) {
  let pendingFibOverlayId: string | null = null
  let pendingFibOptions: PendingRulerOptions | null = null
  let persistenceEnabled = options.initialPersistenceEnabled

  const handleCommand = createRulerToolCommandHandler({
    ...options,
    clearStoredDrawings: clearStoredFibRetracementDrawings,
    getPendingRulerOptions: () => pendingFibOptions,
    getPendingRulerOverlayId: () => pendingFibOverlayId,
    getRulerPersistenceEnabled: () => persistenceEnabled,
    setPendingRulerOptions: (nextOptions) => { pendingFibOptions = nextOptions },
    setPendingRulerOverlayId: (id) => { pendingFibOverlayId = id },
    setRulerPersistenceEnabled: (enabled) => { persistenceEnabled = enabled },
    tool: 'fibRetracement',
  })

  return {
    cleanup: () => {
      if (pendingFibOverlayId) options.chart.removeOverlay({ id: pendingFibOverlayId })
      pendingFibOverlayId = null
      pendingFibOptions = null
    },
    clearPendingOptions: () => {
      pendingFibOptions = null
    },
    getPendingOverlayId: () => pendingFibOverlayId,
    getPendingOptions: () => pendingFibOptions,
    getPersistenceEnabled: () => persistenceEnabled,
    handleCommand,
    setPendingOverlayId: (id: string | null) => { pendingFibOverlayId = id },
  }
}
