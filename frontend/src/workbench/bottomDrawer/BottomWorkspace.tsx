import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useState } from 'react'
import { fetchBridgeLogs } from '../../services/mt5/mt5SymbolsApi'
import { bottomPanels } from './bottomPanels'
import type { BottomPanelId } from './bottomPanels'

type BottomWorkspaceProps = {
  activeBottomPanel: BottomPanelId
  bottomDrawerOpen: boolean
  clockText: string
  onClose: () => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onSelectPanel: (panel: BottomPanelId) => void
}

export function BottomWorkspace({
  activeBottomPanel,
  bottomDrawerOpen,
  clockText,
  onClose,
  onResizePointerDown,
  onSelectPanel,
}: BottomWorkspaceProps) {
  const currentBottomPanel = bottomPanels.find((panel) => panel.id === activeBottomPanel) ?? bottomPanels[0]
  const [logLines, setLogLines] = useState<string[]>([])

  useEffect(() => {
    if (activeBottomPanel !== 'logs' || !bottomDrawerOpen) return
    let disposed = false
    const refresh = () => fetchBridgeLogs(200)
      .then((payload) => {
        if (!disposed) setLogLines(payload.lines)
      })
      .catch((error: unknown) => {
        if (!disposed) setLogLines([error instanceof Error ? error.message : String(error)])
      })
    refresh()
    const intervalId = window.setInterval(refresh, 5000)
    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [activeBottomPanel, bottomDrawerOpen])

  return (
    <section className="ff-bottom-shell" aria-label="Bottom workspace drawer">
      <div className="ff-bottom-toggle-row">
        <div className="ff-bottom-toggle-row__panel-toggles" role="tablist" aria-label="Bottom drawer tabs">
          {bottomPanels.map((panel) => (
            <button
              aria-selected={activeBottomPanel === panel.id && bottomDrawerOpen}
              className="ff-bottom-panel-toggle-btn"
              data-active={activeBottomPanel === panel.id && bottomDrawerOpen ? 'true' : 'false'}
              key={panel.id}
              onClick={() => onSelectPanel(panel.id)}
              role="tab"
              type="button"
            >
              {panel.label}
            </button>
          ))}
        </div>
        <div className="ff-workspace-bottom-status" aria-label="Workspace clock">
          {clockText}
        </div>
      </div>

      <section className="ff-bottom-panel" data-open={bottomDrawerOpen ? 'true' : 'false'}>
        {bottomDrawerOpen && (
          <div
            aria-label="Resize bottom panel"
            className="ff-bottom-panel__resize-handle"
            onPointerDown={onResizePointerDown}
            role="separator"
            tabIndex={0}
          />
        )}
        <header className="ff-bottom-panel__header">
          <span className="ff-bottom-panel__title">{currentBottomPanel.title}</span>
          <button aria-label="Close bottom panel" className="ff-bottom-panel__close" onClick={onClose} type="button">
            x
          </button>
        </header>
        <div className="ff-bottom-panel__body">
          {activeBottomPanel === 'logs' ? (
            <pre className="ff-bottom-panel__placeholder">{logLines.join('\n') || 'No bridge logs yet.'}</pre>
          ) : (
            <p className="ff-bottom-panel__placeholder">{currentBottomPanel.placeholder}</p>
          )}
        </div>
      </section>
    </section>
  )
}
