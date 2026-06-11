import {
  createTrendLineToolCommandHandler,
  type PendingTrendLineOptions,
} from './chartTrendLineToolCommands'

export type { PendingTrendLineOptions }

export function installTrendLineDrawingTool(
  options: Omit<
    Parameters<typeof createTrendLineToolCommandHandler>[0],
    | 'getPendingTrendLineOptions'
    | 'getPendingTrendLineOverlayId'
    | 'getTrendLinePersistenceEnabled'
    | 'setPendingTrendLineOptions'
    | 'setPendingTrendLineOverlayId'
    | 'setTrendLinePersistenceEnabled'
  > & {
    initialPersistenceEnabled: boolean
  },
) {
  let pendingTrendLineOverlayId: string | null = null
  let pendingTrendLineOptions: PendingTrendLineOptions | null = null
  let persistenceEnabled = options.initialPersistenceEnabled

  const handleCommand = createTrendLineToolCommandHandler({
    ...options,
    getPendingTrendLineOptions: () => pendingTrendLineOptions,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getTrendLinePersistenceEnabled: () => persistenceEnabled,
    setPendingTrendLineOptions: (nextOptions) => { pendingTrendLineOptions = nextOptions },
    setPendingTrendLineOverlayId: (id) => { pendingTrendLineOverlayId = id },
    setTrendLinePersistenceEnabled: (enabled) => { persistenceEnabled = enabled },
  })

  return {
    cleanup: () => {
      if (pendingTrendLineOverlayId) options.chart.removeOverlay({ id: pendingTrendLineOverlayId })
      pendingTrendLineOverlayId = null
      pendingTrendLineOptions = null
      options.hidePendingTrendStartHandle()
    },
    clearPendingOptions: () => {
      pendingTrendLineOptions = null
    },
    getPendingTrendLineOptions: () => pendingTrendLineOptions,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getPersistenceEnabled: () => persistenceEnabled,
    handleCommand,
    setPendingTrendLineOverlayId: (id: string | null) => { pendingTrendLineOverlayId = id },
  }
}
