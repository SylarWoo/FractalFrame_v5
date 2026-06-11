import {
  createHorizontalLineToolCommandHandler,
  type PendingHorizontalLineOptions,
} from './chartHorizontalLineToolCommands'

export type { PendingHorizontalLineOptions }

export function installHorizontalLineDrawingTool(
  options: Omit<
    Parameters<typeof createHorizontalLineToolCommandHandler>[0],
    | 'getPendingOverlayId'
    | 'getPersistenceEnabled'
    | 'setPendingOverlayId'
    | 'setPendingOverlayOptions'
    | 'setPersistenceEnabled'
  > & {
    initialPersistenceEnabled: boolean
  },
) {
  let pendingOverlayId: string | null = null
  let pendingOverlayOptions: PendingHorizontalLineOptions | null = null
  let persistenceEnabled = options.initialPersistenceEnabled

  const handleCommand = createHorizontalLineToolCommandHandler({
    ...options,
    getPendingOverlayId: () => pendingOverlayId,
    getPersistenceEnabled: () => persistenceEnabled,
    setPendingOverlayId: (id) => { pendingOverlayId = id },
    setPendingOverlayOptions: (nextOptions) => { pendingOverlayOptions = nextOptions },
    setPersistenceEnabled: (enabled) => { persistenceEnabled = enabled },
  })

  return {
    clearPending: () => {
      pendingOverlayId = null
      pendingOverlayOptions = null
    },
    cleanup: () => {
      if (pendingOverlayId) options.chart.removeOverlay({ id: pendingOverlayId })
      pendingOverlayId = null
      pendingOverlayOptions = null
    },
    getPendingOverlayId: () => pendingOverlayId,
    getPendingOverlayOptions: () => pendingOverlayOptions,
    getPersistenceEnabled: () => persistenceEnabled,
    handleCommand,
    setPendingOverlayId: (id: string | null) => { pendingOverlayId = id },
  }
}
