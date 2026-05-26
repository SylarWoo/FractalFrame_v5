import type { DrawingToolCommand } from '../rightDrawer/drawingToolCommands'
import type { createStickerOverlayController } from './stickerOverlay'

export function createStickerDrawingCommandHandler({
  getPersistenceEnabled,
  persist,
  setPersistenceEnabled,
  stickerController,
}: {
  getPersistenceEnabled: () => boolean
  persist: () => void
  setPersistenceEnabled: (enabled: boolean) => void
  stickerController: ReturnType<typeof createStickerOverlayController> | null
}) {
  return function handleStickerCommand(command: DrawingToolCommand) {
    if (command.action === 'start') {
      stickerController?.start({
        bold: command.stickerBold ?? command.textStyle?.bold,
        color: command.stickerColor,
        fontFamily: command.stickerFontFamily ?? command.textStyle?.fontFamily,
        italic: command.stickerItalic ?? command.textStyle?.italic,
        locked: command.locked === true,
        size: command.stickerSize,
        symbol: command.stickerSymbol,
      })
      return
    }
    if (command.action === 'release') {
      stickerController?.release()
      return
    }
    if (command.action === 'deleteSelected') {
      stickerController?.deleteSelected()
      return
    }
    if (command.action === 'toggleSelectedLock') {
      stickerController?.toggleSelectedLock()
      return
    }
    if (command.action === 'updatePersistence') {
      const nextEnabled = command.persisted !== false
      if (getPersistenceEnabled() !== nextEnabled) setPersistenceEnabled(nextEnabled)
      persist()
      return
    }
    if (command.action === 'updateSelectedStickerStyle') {
      stickerController?.updateOptions({
        bold: command.stickerBold ?? command.textStyle?.bold,
        color: command.stickerColor,
        fontFamily: command.stickerFontFamily ?? command.textStyle?.fontFamily,
        italic: command.stickerItalic ?? command.textStyle?.italic,
        locked: command.locked,
        size: command.stickerSize,
        symbol: command.stickerSymbol,
        textStyle: command.textStyle,
      })
    }
  }
}
