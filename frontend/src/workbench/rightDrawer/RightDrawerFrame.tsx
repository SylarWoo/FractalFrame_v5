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
  if (activeDrawer === 'strategy') return '策略'
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
            <path d="M40.5,5.5H7.5c-1.1046,0-2,.8954-2,2V40.5c0,1.1046,.8954,2,2,2H40.5c1.1046,0,2-.8954,2-2V7.5c0-1.1046-.8954-2-2-2Z" />
            <path d="M26.9703,13.5l4.7051,4.6263-12.0651,12.1439-6.0982,1.3406,1.6823-6.072,11.7759-12.0388Z" />
            <path d="M14.0641,34.1867c8.2785,1.0696,13.1772-.6453,15.2719-4.4423,.6936-1.2573-.7598-3.0337-2.4708-.9989-2.2764,2.7071-.6526,9.3247,5.2045,2.5234-1.1558,3.4735-.1384,3.5847,2.4183,1.3143" />
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
        <button className="ff-right-rail__button" data-active={activeDrawer === 'strategy'} onClick={() => onToggleDrawer('strategy')} title="策略" type="button">
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="m40.5,5.5H7.5c-1.1,0-2,.9-2,2v33c0,1.1.9,2,2,2h33c1.1,0,2-.9,2-2V7.5c0-1.1-.9-2-2-2Z" />
            <line x1="32.9" y1="13.9" x2="32.9" y2="34.1" />
            <polyline points="14 14.9 23.2 24 14 33.1" />
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
