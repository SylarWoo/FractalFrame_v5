import type { Chart } from 'klinecharts'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { createStickerDrawingCommandHandler } from './stickerDrawingCommands'
import { createStickerOverlayController, type StickerOverlayOptions } from './stickerOverlay'

type StickerPoint = { dataIndex?: number; timestamp?: number; value?: number }

export function installStickerDrawingTool(options: {
  chart: Chart
  fallbackPaneId: string
  initialPersistenceEnabled: boolean
  persist: () => void
  publishObjectTreeState: () => void
}) {
  let persistenceEnabled = options.initialPersistenceEnabled
  const controller = createStickerOverlayController({
    chart: options.chart,
    fallbackPaneId: options.fallbackPaneId,
    onState: (state) => {
      publishDrawingToolState(state)
      options.persist()
      options.publishObjectTreeState()
    },
  })
  const handleCommand = createStickerDrawingCommandHandler({
    getPersistenceEnabled: () => persistenceEnabled,
    persist: options.persist,
    setPersistenceEnabled: (enabled) => { persistenceEnabled = enabled },
    stickerController: controller,
  })

  return {
    cleanup: () => controller.cleanup(),
    createOverlayFromStored: (paneId: string | undefined, point: StickerPoint, restoredOptions: Partial<StickerOverlayOptions>) => (
      controller.restore(paneId ?? options.fallbackPaneId, point, restoredOptions)
    ),
    deleteSelected: () => controller.deleteSelected(),
    getOverlayIds: () => controller.getOverlayIds(),
    getPersistenceEnabled: () => persistenceEnabled,
    getSelectedId: () => controller.getSelectedId(),
    getSelectedIds: () => controller.getSelectedIds(),
    handleCommand,
    persistableOverlays: () => controller.persistableOverlays(),
    select: (id: string | null, additive?: boolean) => controller.select(id, additive),
    setManualVisible: (id: string, manualVisible: boolean) => controller.setManualVisible(id, manualVisible),
    setSelectedLock: (id: string, locked: boolean) => controller.setSelectedLock(id, locked),
    toggleSelectedLock: () => controller.toggleSelectedLock(),
  }
}
