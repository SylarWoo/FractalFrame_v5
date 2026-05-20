import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'

type RightDrawerFrameProps = {
  activeDrawer: 'mt5' | 'settings' | null
  children: ReactNode
  onClose: () => void
  onResize: (width: number) => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleDrawer: (drawer: 'mt5' | 'settings') => void
  open: boolean
  topPaneHeight: number
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
          <h2>{activeDrawer === 'settings' ? 'Settings' : 'MT5 Import Center'}</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">x</button>
        </header>
        {children}
      </aside>
    </>
  )
}
