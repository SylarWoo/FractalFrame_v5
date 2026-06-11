import { createRulerToolCommandHandler } from './chartRulerToolCommands'
import type { PendingRulerOptions } from './rulerOverlayController'

export type { PendingRulerOptions }

export function installRulerDrawingTool(
  options: Omit<
    Parameters<typeof createRulerToolCommandHandler>[0],
    | 'getPendingRulerOptions'
    | 'getPendingRulerOverlayId'
    | 'getRulerPersistenceEnabled'
    | 'setPendingRulerOptions'
    | 'setPendingRulerOverlayId'
    | 'setRulerPersistenceEnabled'
    | 'tool'
  > & {
    initialPersistenceEnabled: boolean
  },
) {
  let pendingRulerOverlayId: string | null = null
  let pendingRulerOptions: PendingRulerOptions | null = null
  let persistenceEnabled = options.initialPersistenceEnabled

  const handleCommand = createRulerToolCommandHandler({
    ...options,
    getPendingRulerOptions: () => pendingRulerOptions,
    getPendingRulerOverlayId: () => pendingRulerOverlayId,
    getRulerPersistenceEnabled: () => persistenceEnabled,
    setPendingRulerOptions: (nextOptions) => { pendingRulerOptions = nextOptions },
    setPendingRulerOverlayId: (id) => { pendingRulerOverlayId = id },
    setRulerPersistenceEnabled: (enabled) => { persistenceEnabled = enabled },
    tool: 'ruler',
  })

  return {
    cleanup: () => {
      if (pendingRulerOverlayId) options.chart.removeOverlay({ id: pendingRulerOverlayId })
      pendingRulerOverlayId = null
      pendingRulerOptions = null
    },
    clearPendingOptions: () => {
      pendingRulerOptions = null
    },
    getPendingOverlayId: () => pendingRulerOverlayId,
    getPendingOptions: () => pendingRulerOptions,
    getPersistenceEnabled: () => persistenceEnabled,
    handleCommand,
    setPendingOverlayId: (id: string | null) => { pendingRulerOverlayId = id },
  }
}
