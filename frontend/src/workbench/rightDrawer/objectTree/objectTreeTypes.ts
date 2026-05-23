import { drawingMainPaneId } from '../../drawing/drawingPaneModel'

export type ObjectTreeDrawingKind = 'horizontalLine' | 'trendLine'

export type ObjectTreeDrawingItem = {
  id: string
  kind: ObjectTreeDrawingKind
  label: string
  locked: boolean
  manualVisible: boolean
  overlayId: string
  paneId: string
  periodVisible: boolean
  selected: boolean
  visible: boolean
}

export type ObjectTreeDrawingCommand =
  | { action: 'delete'; id: string; ids?: string[] }
  | { action: 'deselect'; id: string }
  | { action: 'deselectAll' }
  | { action: 'select'; additive?: boolean; id: string }
  | { action: 'setLocked'; id: string; ids?: string[]; locked: boolean }
  | { action: 'setVisible'; id: string; ids?: string[]; visible: boolean }

export type ObjectTreeGroup = {
  collapsed: boolean
  id: string
  itemIds: string[]
  name: string
  paneId: string
}

export const objectTreeMainPaneId = drawingMainPaneId
