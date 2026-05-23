export function createChartDrawingModifierKeys() {
  let additiveSelectionActive = false

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = false
  }

  const install = () => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  }

  const cleanup = () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    additiveSelectionActive = false
  }

  return {
    cleanup,
    getAdditiveSelectionActive: () => additiveSelectionActive,
    install,
  }
}
