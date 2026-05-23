import { readJson, writeJson } from '../../persistence/jsonStorage'
import { objectTreeMainPaneId, type ObjectTreeDrawingItem, type ObjectTreeGroup } from './objectTreeTypes'

const objectTreeGroupsStorageKey = 'fractalframe.objectTree.groups.v1'

export function normalizeObjectTreeGroups(value: unknown): ObjectTreeGroup[] {
  if (!Array.isArray(value)) return []
  return value
    .map((group): ObjectTreeGroup | null => {
      if (group == null || typeof group !== 'object') return null
      const itemIds = Array.isArray((group as Partial<ObjectTreeGroup>).itemIds)
        ? (group as Partial<ObjectTreeGroup>).itemIds?.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) ?? []
        : []
      const id = typeof (group as Partial<ObjectTreeGroup>).id === 'string' && (group as Partial<ObjectTreeGroup>).id?.trim()
        ? (group as Partial<ObjectTreeGroup>).id as string
        : `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const name = typeof (group as Partial<ObjectTreeGroup>).name === 'string' && (group as Partial<ObjectTreeGroup>).name?.trim()
        ? (group as Partial<ObjectTreeGroup>).name as string
        : '\u7ec4'
      const paneId = typeof (group as Partial<ObjectTreeGroup>).paneId === 'string' && (group as Partial<ObjectTreeGroup>).paneId?.trim()
        ? (group as Partial<ObjectTreeGroup>).paneId as string
        : objectTreeMainPaneId
      return itemIds.length > 0 ? { collapsed: (group as Partial<ObjectTreeGroup>).collapsed === true, id, itemIds, name, paneId } : null
    })
    .filter((group): group is ObjectTreeGroup => group != null)
}

export function readObjectTreeGroups() {
  return normalizeObjectTreeGroups(readJson(objectTreeGroupsStorageKey, []))
}

export function writeObjectTreeGroups(groups: ObjectTreeGroup[]) {
  writeJson(objectTreeGroupsStorageKey, groups)
}

export function pruneObjectTreeGroups(groups: ObjectTreeGroup[], items: ObjectTreeDrawingItem[]) {
  return groups
    .map((group) => ({ ...group, itemIds: group.itemIds.filter((id) => items.some((item) => item.id === id)) }))
    .filter((group) => group.itemIds.length > 0)
}

export function createObjectTreeGroup(items: ObjectTreeDrawingItem[], index: number): ObjectTreeGroup | null {
  if (!items[0]) return null
  return {
    id: `group-${Date.now()}`,
    collapsed: false,
    itemIds: items.map((item) => item.id),
    name: `\u7ec4 ${index + 1}`,
    paneId: items[0].paneId,
  }
}
