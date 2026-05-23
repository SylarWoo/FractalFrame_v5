import type { ObjectTreeDrawingItem } from './objectTreeTypes'

export type ObjectTreeHiddenKind = 'absolute' | 'period' | undefined

export function objectTreeVisibilityStorageKey(item: Pick<ObjectTreeDrawingItem, 'id' | 'kind'>) {
  if (item.kind === 'horizontalLine') return `drawing:horizontalLine:${item.id}`
  return `drawing:${item.kind}:${item.id}`
}

export function objectTreeHiddenKind(item: Pick<ObjectTreeDrawingItem, 'manualVisible' | 'periodVisible' | 'visible'>): ObjectTreeHiddenKind {
  if (item.visible) return undefined
  return item.manualVisible === false ? 'absolute' : item.periodVisible === false ? 'period' : undefined
}

export function shortObjectTreeId(id: string) {
  const normalized = id.trim()
  if (/^HL\d+$/i.test(normalized)) return normalized.toUpperCase()
  if (/^TL\d+$/i.test(normalized)) return normalized.toUpperCase()
  if (normalized.length <= 6) return normalized
  return normalized.slice(-6).toUpperCase()
}
