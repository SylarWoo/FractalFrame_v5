export type ObjectTreeDrawingKind = 'horizontalLine'

export type ObjectTreeDrawingItem = {
  id: string
  kind: ObjectTreeDrawingKind
  label: string
  locked: boolean
  paneId: string
  selected: boolean
  visible: boolean
}

export type ObjectTreeDrawingCommand =
  | { action: 'delete'; id: string }
  | { action: 'deselect'; id: string }
  | { action: 'deselectAll' }
  | { action: 'select'; additive?: boolean; id: string }
  | { action: 'setLocked'; id: string; locked: boolean }
  | { action: 'setVisible'; id: string; visible: boolean }

export const objectTreeDrawingsChangedEvent = 'fractalframe:object-tree-drawings-changed'
export const objectTreeDrawingsRequestEvent = 'fractalframe:object-tree-drawings-request'
export const objectTreeDrawingCommandEvent = 'fractalframe:object-tree-drawing-command'

export function publishObjectTreeDrawings(items: ObjectTreeDrawingItem[]) {
  window.dispatchEvent(new CustomEvent<{ items: ObjectTreeDrawingItem[] }>(objectTreeDrawingsChangedEvent, {
    detail: { items },
  }))
}

export function requestObjectTreeDrawings() {
  window.dispatchEvent(new Event(objectTreeDrawingsRequestEvent))
}

export function publishObjectTreeDrawingCommand(command: ObjectTreeDrawingCommand) {
  window.dispatchEvent(new CustomEvent<ObjectTreeDrawingCommand>(objectTreeDrawingCommandEvent, {
    detail: command,
  }))
}

export function isObjectTreeDrawingCommandEvent(event: Event): event is CustomEvent<ObjectTreeDrawingCommand> {
  return event instanceof CustomEvent &&
    event.type === objectTreeDrawingCommandEvent &&
    (event.detail?.action === 'deselectAll' || typeof event.detail?.id === 'string')
}
