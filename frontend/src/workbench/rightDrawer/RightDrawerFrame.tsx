import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { ObjectTreeIcon } from './RightDrawerIcons'
import type { RightDrawerId } from './RightDrawerTypes'

type RightDrawerFrameProps = {
  activeDrawer: RightDrawerId | null
  children: ReactNode
  onClose: () => void
  onResize: (width: number) => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleDrawer: (drawer: RightDrawerId) => void
  open: boolean
  topPaneHeight: number
}

function resolveRightDrawerTitle(activeDrawer: RightDrawerId | null) {
  if (activeDrawer === 'drawings') return 'Drawings'
  if (activeDrawer === 'objectTree') return 'Object Tree'
  if (activeDrawer === 'indicators') return 'Indicators'
  if (activeDrawer === 'settings') return 'Settings'
  return 'MT5 Import Center'
}

export function RightDrawerFrame({
  activeDrawer,
  children,
  onClose,
  onResize,
  onResizePointerDown,
  onToggleDrawer,
  open,
  topPaneHeight,
}: RightDrawerFrameProps) {
  return (
    <>
      <div className="ff-right-rail" aria-label="Right toolbar">
        <button className="ff-right-rail__button" data-active={activeDrawer === 'drawings'} onClick={() => onToggleDrawer('drawings')} title="画图" type="button">
          <svg className="ff-right-rail__drawing-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M22.7966,26.3062l3.5555-3.5555" />
            <path d="M42.55,39.0406,24.9023,21.2927l3.9106-.8022-5.0136-5.0136L25.905,8.7588l-6.9187,1.9051L14.2736,5.55,12.6692,12.168,5.55,13.6721l5.2141,5.0135L8.4579,25.504l7.0189-2.0054,4.813,5.2141,1.103-3.81L38.94,42.45C40.344,42.65,42.35,40.2439,42.55,39.0406Z" />
            <path d="M21.3928,24.9024l-5.3144-5.0135a4.5925,4.5925,0,0,1,3.71-3.71l5.1138,5.1138" />
          </svg>
        </button>
        <button className="ff-right-rail__button" data-active={activeDrawer === 'objectTree'} onClick={() => onToggleDrawer('objectTree')} title="Object Tree" type="button">
          <ObjectTreeIcon />
        </button>
        <button className="ff-right-rail__button" data-active={activeDrawer === 'indicators'} onClick={() => onToggleDrawer('indicators')} title="指标" type="button">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M41.68,13H24.77c-2-.1-5.93-4.23-8.19-4.23H6.68A2.18,2.18,0,0,0,4.5,11h0v7.29h39V14.87A1.83,1.83,0,0,0,41.68,13Z" />
            <path d="M43.5,18.28H4.5V37A2.18,2.18,0,0,0,6.67,39.2H41.32A2.18,2.18,0,0,0,43.5,37h0Z" />
            <line x1="32.17" y1="23.03" x2="37.85" y2="23.03" />
            <line x1="32.17" y1="28.72" x2="35.86" y2="28.72" />
            <line x1="32.17" y1="23.03" x2="32.17" y2="34.4" />
          </svg>
        </button>
        <button className="ff-right-rail__button" data-active={activeDrawer === 'mt5'} onClick={() => onToggleDrawer('mt5')} title="MT5 Import Center" type="button">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M43.5,14.9312c0,4.251-8.73,7.6971-19.5,7.6971S4.5,19.1822,4.5,14.9312,13.23,7.234,24,7.234,43.5,10.68,43.5,14.9312Z" />
            <path d="M43.5,23.9991c0,4.251-8.73,7.6971-19.5,7.6971S4.5,28.25,4.5,23.9991" />
            <path d="M43.5,33.0688c0,4.251-8.73,7.6972-19.5,7.6972S4.5,37.32,4.5,33.0688" />
            <path d="M4.5,33.0688v-9.07" />
            <path d="M43.5,33.0688v-9.07" />
            <path d="M43.5,23.9991v-9.07" />
            <path d="M4.5,24V14.93" />
          </svg>
        </button>
        <button className="ff-right-rail__button" data-active={activeDrawer === 'settings'} onClick={() => onToggleDrawer('settings')} title="Settings" type="button">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <polygon points="34.75 5.38 13.25 5.38 2.5 24 13.25 42.62 34.75 42.62 45.5 24 34.75 5.38" />
            <circle cx="24" cy="24" r="7.5" />
          </svg>
        </button>
      </div>
      <aside className="ff-right-drawer" data-open={open} aria-hidden={!open} style={{ ['--ff-mt5-top-pane-height' as string]: `${topPaneHeight}px` }}>
        <div className="ff-right-drawer__resize-handle" onDoubleClick={() => onResize(280)} onPointerDown={onResizePointerDown} role="separator" aria-orientation="vertical" aria-label="Resize right panel" tabIndex={0} />
        <header className="ff-right-drawer__header">
          <h2>{resolveRightDrawerTitle(activeDrawer)}</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">x</button>
        </header>
        {children}
      </aside>
    </>
  )
}
