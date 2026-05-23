import type { ObjectTreeDrawingCommand, ObjectTreeDrawingItem } from './objectTreeTypes'

export const objectTreeDrawingsChangedEvent = 'fractalframe:object-tree-drawings-changed'
export const objectTreeDrawingsRequestEvent = 'fractalframe:object-tree-drawings-request'
export const objectTreeDrawingCommandEvent = 'fractalframe:object-tree-drawing-command'

export type ObjectTreeDrawingsChangedDetail = {
  activeId?: string
  items: ObjectTreeDrawingItem[]
}

export function publishObjectTreeDrawings(items: ObjectTreeDrawingItem[], activeId?: string) {
  window.dispatchEvent(new CustomEvent<ObjectTreeDrawingsChangedDetail>(objectTreeDrawingsChangedEvent, {
    detail: { activeId, items },
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
