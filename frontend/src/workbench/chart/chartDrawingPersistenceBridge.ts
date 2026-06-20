import type { createChartDrawingPersistenceController } from './chartDrawingPersistenceController'

export type ChartDrawingPersistenceController = ReturnType<typeof createChartDrawingPersistenceController>

export function createChartDrawingPersistenceBridge() {
  let controller: ChartDrawingPersistenceController | null = null

  const restoreAllPendingStoredDrawings = () => {
    controller?.restorePendingStoredHorizontalLines()
    controller?.restorePendingStoredFibRetracements()
    controller?.restorePendingStoredRulers()
    controller?.restorePendingStoredTrendLines()
    controller?.restorePendingStoredEmojiStickers()
  }

  const syncSharedStoredDrawings = () => {
    controller?.syncStoredHorizontalLines()
    controller?.syncStoredTrendLines()
  }

  return {
    persistCurrentEmojiStickers: () => controller?.persistCurrentEmojiStickers(),
    persistCurrentFibRetracements: () => controller?.persistCurrentFibRetracements(),
    persistCurrentHorizontalLines: () => controller?.persistCurrentHorizontalLines(),
    persistCurrentRulers: () => controller?.persistCurrentRulers(),
    persistCurrentTrendLines: () => controller?.persistCurrentTrendLines(),
    restoreAllPendingStoredDrawings,
    restorePendingStoredEmojiStickers: () => controller?.restorePendingStoredEmojiStickers(),
    restorePendingStoredFibRetracements: () => controller?.restorePendingStoredFibRetracements(),
    restorePendingStoredHorizontalLines: () => controller?.restorePendingStoredHorizontalLines(),
    restorePendingStoredRulers: () => controller?.restorePendingStoredRulers(),
    restorePendingStoredTrendLines: () => controller?.restorePendingStoredTrendLines(),
    syncSharedStoredDrawings,
    setController: (nextController: ChartDrawingPersistenceController) => {
      controller = nextController
    },
  }
}
