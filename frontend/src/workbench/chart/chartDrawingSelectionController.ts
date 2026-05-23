export function createHorizontalLineSelectionController({
  clearTrendLineSelection,
  horizontalLineOverlayIds,
  resolveSelectedOverlayId,
  selectedHorizontalLineOverlayIds,
  setActiveHorizontalLine,
  updateOverlayState,
}: {
  clearTrendLineSelection: () => void
  horizontalLineOverlayIds: Set<string>
  resolveSelectedOverlayId: () => string | null
  selectedHorizontalLineOverlayIds: Set<string>
  setActiveHorizontalLine: (id: string | null) => void
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  const setSelectedHorizontalLine = (id: string, additive: boolean) => {
    if (!additive) clearTrendLineSelection()
    horizontalLineOverlayIds.forEach((overlayId) => {
      if (additive && overlayId !== id) return
      updateOverlayState(overlayId, { selected: overlayId === id })
    })
    setActiveHorizontalLine(id)
  }

  const toggleSelectedHorizontalLine = (id: string) => {
    const selected = selectedHorizontalLineOverlayIds.has(id)
    updateOverlayState(id, { selected: !selected })
    setActiveHorizontalLine(selected ? resolveSelectedOverlayId() : id)
  }

  return {
    setSelectedHorizontalLine,
    toggleSelectedHorizontalLine,
  }
}
