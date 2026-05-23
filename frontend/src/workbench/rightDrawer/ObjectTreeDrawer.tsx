import { useEffect, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import {
  objectTreeDrawingsChangedEvent,
  publishObjectTreeDrawingCommand,
  requestObjectTreeDrawings,
} from './objectTree/objectTreeModel'
import { createObjectTreeGroup, pruneObjectTreeGroups, readObjectTreeGroups, writeObjectTreeGroups } from './objectTree/objectTreeGroups'
import { objectTreeHiddenKind, objectTreeVisibilityStorageKey, shortObjectTreeId } from './objectTree/objectTreeVisibility'
import { objectTreeMainPaneId, type ObjectTreeDrawingItem, type ObjectTreeGroup } from './objectTree/objectTreeTypes'
import { VisibilityRangePanel } from '../visibilityRange/VisibilityRangePanel'
import { compareDrawingSubPaneIds, drawingSubPaneTitle } from '../drawing/drawingPaneModel'
import './ObjectTreeDrawer.css'

const defaultTopHeight = 340
const minTopHeight = 96
const maxTopHeight = 520
export function ObjectTreeDrawer() {
  const [drawingItems, setDrawingItems] = useState<ObjectTreeDrawingItem[]>([])
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groups, setGroups] = useState<ObjectTreeGroup[]>(readObjectTreeGroups)
  const [topHeight, setTopHeight] = useState(defaultTopHeight)
  const [visibilityPanelVersion, setVisibilityPanelVersion] = useState(0)

  useEffect(() => {
    const handleDrawingsChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const items = Array.isArray(event.detail?.items) ? event.detail.items as ObjectTreeDrawingItem[] : []
      setDrawingItems(items)
      setSelectedDrawingIds(items.filter((item) => item.selected).map((item) => item.id))
      setGroups((current) => pruneObjectTreeGroups(current, items))
    }
    window.addEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
    requestObjectTreeDrawings()
    return () => window.removeEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
  }, [])

  useEffect(() => {
    writeObjectTreeGroups(groups)
  }, [groups])

  const mainDrawings = drawingItems.filter((item) => item.paneId === objectTreeMainPaneId)
  const subPaneDrawings = drawingItems.filter((item) => item.paneId !== objectTreeMainPaneId)
  const subPaneIds = useMemo(
    () => Array.from(new Set(subPaneDrawings.map((item) => item.paneId))).sort(compareDrawingSubPaneIds),
    [subPaneDrawings],
  )
  const selectedDrawings = drawingItems.filter((item) => selectedDrawingIds.includes(item.id))
  const selectedGroup = selectedGroupId ? groups.find((group) => group.id === selectedGroupId) ?? null : null
  const visibilityStorageKeys = (selectedGroup
    ? drawingItems.filter((item) => selectedGroup.itemIds.includes(item.id))
    : selectedDrawings).map(objectTreeVisibilityStorageKey)
  const canGroup = selectedDrawings.length > 1 && selectedDrawings.every((item) => item.paneId === selectedDrawings[0]?.paneId)

  const selectDrawing = (id: string, additive: boolean) => {
    setSelectedGroupId(null)
    setSelectedDrawingIds((current) => additive
      ? current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
      : [id])
    publishObjectTreeDrawingCommand({ action: 'select', additive, id })
  }

  const selectGroup = (groupId: string, ids: string[], additive: boolean) => {
    if (ids.length === 0) return
    setSelectedGroupId(additive ? null : groupId)
    setSelectedDrawingIds((current) => additive
      ? Array.from(new Set([...current, ...ids]))
      : ids)
    ids.forEach((id, index) => {
      publishObjectTreeDrawingCommand({ action: 'select', additive: additive || index > 0, id })
    })
  }

  const clearSelection = () => {
    setSelectedDrawingIds([])
    setSelectedGroupId(null)
    publishObjectTreeDrawingCommand({ action: 'deselectAll' })
  }

  const setDrawingVisible = (id: string, ids: string[] | undefined, visible: boolean, refreshVisibilityPanel: boolean) => {
    publishObjectTreeDrawingCommand({ action: 'setVisible', id, ids, visible })
    if (refreshVisibilityPanel) setVisibilityPanelVersion((current) => current + 1)
  }

  const groupSelectedDrawings = () => {
    if (!canGroup || !selectedDrawings[0]) return
    const itemIds = selectedDrawings.map((item) => item.id)
    const nextGroup = createObjectTreeGroup(selectedDrawings, groups.length)
    if (!nextGroup) return
    setGroups((current) => [
      ...current.filter((group) => !group.itemIds.some((id) => itemIds.includes(id))),
      nextGroup,
    ])
    setSelectedDrawingIds([])
    setSelectedGroupId(null)
  }

  const renameGroup = (groupId: string, name: string) => {
    const normalized = name.trim()
    setGroups((current) => current.map((group) => group.id === groupId
      ? { ...group, name: normalized || group.name }
      : group))
  }

  const toggleGroupCollapsed = (groupId: string) => {
    setGroups((current) => current.map((group) => group.id === groupId
      ? { ...group, collapsed: !group.collapsed }
      : group))
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeObjectTreeSplitting = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(Math.max(minTopHeight, Math.min(maxTopHeight, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-object-tree-splitting')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture can already be released.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <section className="ff-object-tree-drawer" data-right-widget-panel="object-tree">
      <div className="ff-indicators-split-v1 ff-object-tree-split-v1" style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}>
        <div className="ff-indicators-split-v1__top ff-object-tree-split-v1__top" onClick={clearSelection}>
          <div className="ff-object-tree-toolbar">
            <button
              aria-label="Group selected drawings"
              className="ff-object-tree-toolbar__button"
              disabled={!canGroup}
              onClick={(event) => {
                event.stopPropagation()
                groupSelectedDrawings()
              }}
              type="button"
            >
              {'\u7ec4\u5408'}
            </button>
          </div>

          <div className="ff-object-tree-list">
            <ObjectTreeSection title={'\u4e3b\u56fe'}>
              <DrawingRows drawings={mainDrawings} groups={groups.filter((group) => group.paneId === objectTreeMainPaneId)} selectedIds={selectedDrawingIds} onRenameGroup={renameGroup} onSelect={selectDrawing} onSelectGroup={selectGroup} onSetVisible={setDrawingVisible} onToggleGroupCollapsed={toggleGroupCollapsed} />
            </ObjectTreeSection>

            <div className="ff-object-tree-separator" />

            {subPaneIds.map((paneId) => (
              <ObjectTreeSection key={paneId} title={drawingSubPaneTitle(paneId)}>
                <DrawingRows drawings={subPaneDrawings.filter((item) => item.paneId === paneId)} groups={groups.filter((group) => group.paneId === paneId)} selectedIds={selectedDrawingIds} onRenameGroup={renameGroup} onSelect={selectDrawing} onSelectGroup={selectGroup} onSetVisible={setDrawingVisible} onToggleGroupCollapsed={toggleGroupCollapsed} />
              </ObjectTreeSection>
            ))}
          </div>
        </div>

        <button
          aria-label="Resize object tree drawer split"
          className="ff-indicators-split-v1__handle"
          onPointerDown={handleSplitPointerDown}
          title="\u4e0a\u4e0b\u62d6\u52a8\u8c03\u6574\u7a97\u53e3\u5927\u5c0f"
          type="button"
        />

        <div className="ff-indicators-split-v1__bottom ff-object-tree-split-v1__bottom" onClick={(event) => event.stopPropagation()}>
          <div className="ff-object-tree-section__title">{'\u53ef\u89c1\u8303\u56f4'}</div>
          <div className="ff-object-tree-visibility-selected">
            {selectedGroup ? (
              <span className="ff-object-tree-visibility-selected__chip" title={selectedGroup.name}>
                <span className="ff-object-tree-visibility-selected__label">{selectedGroup.name}</span>
              </span>
            ) : selectedDrawings.map((item, index) => (
              <span className="ff-object-tree-visibility-selected__chip" key={item.id} title={item.id}>
                <span className="ff-object-tree-row__id">{shortObjectTreeId(item.id)}</span>
                <span className="ff-object-tree-visibility-selected__label">{item.label}</span>
                {index < selectedDrawings.length - 1 ? <span className="ff-object-tree-visibility-selected__comma">,</span> : null}
              </span>
            ))}
          </div>
          <div className="ff-object-tree-visibility-pane__body">
            <VisibilityRangePanel key={`${visibilityStorageKeys.join('|')}:${visibilityPanelVersion}`} storageKeys={visibilityStorageKeys} />
          </div>
        </div>
      </div>
    </section>
  )
}

function ObjectTreeSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="ff-object-tree-section">
      <div className="ff-object-tree-section__title">{title}</div>
      <div className="ff-object-tree-section__rows">{children}</div>
    </section>
  )
}

function DrawingRows({
  drawings,
  groups,
  onRenameGroup,
  onSelect,
  onSelectGroup,
  onSetVisible,
  onToggleGroupCollapsed,
  selectedIds,
}: {
  drawings: ObjectTreeDrawingItem[]
  groups: ObjectTreeGroup[]
  onRenameGroup: (groupId: string, name: string) => void
  onSelect: (id: string, additive: boolean) => void
  onSelectGroup: (groupId: string, ids: string[], additive: boolean) => void
  onSetVisible: (id: string, ids: string[] | undefined, visible: boolean, refreshVisibilityPanel: boolean) => void
  onToggleGroupCollapsed: (groupId: string) => void
  selectedIds: string[]
}) {
  const groupedIds = new Set(groups.flatMap((group) => group.itemIds))
  const ungrouped = drawings.filter((item) => !groupedIds.has(item.id))
  return (
    <>
      {groups.map((group) => (
        <div className="ff-object-tree-group" key={group.id}>
          <GroupRow group={group} items={drawings.filter((item) => group.itemIds.includes(item.id))} selectedIds={selectedIds} onRename={onRenameGroup} onSelectGroup={onSelectGroup} onSetVisible={onSetVisible} onToggleCollapsed={onToggleGroupCollapsed} />
          {group.collapsed ? null : drawings.filter((item) => group.itemIds.includes(item.id)).map((item) => (
            <DrawingRow child key={item.id} item={item} selected={selectedIds.includes(item.id)} selectedIds={selectedIds} onSelect={onSelect} onSetVisible={onSetVisible} />
          ))}
        </div>
      ))}
      {ungrouped.map((item) => (
        <DrawingRow key={item.id} item={item} selected={selectedIds.includes(item.id)} selectedIds={selectedIds} onSelect={onSelect} onSetVisible={onSetVisible} />
      ))}
    </>
  )
}

function GroupRow({
  group,
  items,
  onRename,
  onSelectGroup,
  onSetVisible,
  onToggleCollapsed,
  selectedIds,
}: {
  group: ObjectTreeGroup
  items: ObjectTreeDrawingItem[]
  onRename: (groupId: string, name: string) => void
  onSelectGroup: (groupId: string, ids: string[], additive: boolean) => void
  onSetVisible: (id: string, ids: string[] | undefined, visible: boolean, refreshVisibilityPanel: boolean) => void
  onToggleCollapsed: (groupId: string) => void
  selectedIds: string[]
}) {
  const [editing, setEditing] = useState(false)
  const itemIds = items.map((item) => item.id)
  const visible = items.length > 0 && items.every((item) => item.visible)
  const manualVisible = items.length > 0 && items.every((item) => item.manualVisible !== false)
  const periodVisible = items.length > 0 && items.every((item) => item.periodVisible !== false)
  const locked = items.length > 0 && items.every((item) => item.locked)
  const selected = itemIds.length > 0 && itemIds.every((id) => selectedIds.includes(id))
  const firstId = itemIds[0]
  const groupHiddenKind = objectTreeHiddenKind({ manualVisible, periodVisible, visible })
  const nextVisible = groupHiddenKind === 'period' ? true : !manualVisible
  if (!firstId) return null
  return (
    <div
      className="ff-object-tree-row"
      data-kind="group"
      data-selected={selected ? 'true' : undefined}
      onClick={(event) => {
        event.stopPropagation()
        onSelectGroup(group.id, itemIds, event.ctrlKey || event.metaKey)
      }}
    >
      {editing ? (
        <input
          aria-label="Group name"
          autoFocus
          className="ff-object-tree-row__name-input"
          defaultValue={group.name}
          onBlur={(event) => {
            onRename(group.id, event.currentTarget.value)
            setEditing(false)
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              event.currentTarget.value = group.name
              event.currentTarget.blur()
            }
          }}
        />
      ) : (
        <div className="ff-object-tree-row__group-label">
          <button
            aria-label={group.collapsed ? '\u5c55\u5f00\u7ec4' : '\u6536\u8d77\u7ec4'}
            className="ff-object-tree-row__group-toggle"
            data-collapsed={group.collapsed ? 'true' : undefined}
            onClick={(event) => {
              event.stopPropagation()
              onToggleCollapsed(group.id)
            }}
            type="button"
          />
          <button
            className="ff-object-tree-row__label-button"
            data-multiselected={selected ? 'true' : undefined}
            onDoubleClick={(event) => {
              event.stopPropagation()
              setEditing(true)
            }}
            type="button"
          >
            {group.name}
          </button>
        </div>
      )}
      <button className="ff-object-tree-row__tool" data-hidden-kind={groupHiddenKind} onClick={(event) => { event.stopPropagation(); onSetVisible(firstId, itemIds, nextVisible, groupHiddenKind === 'period' && nextVisible) }} type="button">{visible ? '\u663e\u793a' : '\u9690\u85cf'}</button>
      <button className="ff-object-tree-row__tool" onClick={(event) => { event.stopPropagation(); publishObjectTreeDrawingCommand({ action: 'setLocked', id: firstId, ids: itemIds, locked: !locked }) }} type="button">{locked ? '\u9501' : '\u5f00'}</button>
      <button className="ff-object-tree-row__tool" onClick={(event) => { event.stopPropagation(); publishObjectTreeDrawingCommand({ action: 'delete', id: firstId, ids: itemIds }) }} type="button">{'\u5220'}</button>
    </div>
  )
}

function DrawingRow({
  child,
  item,
  onSelect,
  onSetVisible,
  selected,
  selectedIds,
}: {
  child?: boolean
  item: ObjectTreeDrawingItem
  onSelect: (id: string, additive: boolean) => void
  onSetVisible: (id: string, ids: string[] | undefined, visible: boolean, refreshVisibilityPanel: boolean) => void
  selected: boolean
  selectedIds?: string[]
}) {
  const targetIds = selected && selectedIds && selectedIds.length > 1 ? selectedIds : [item.id]
  const shortId = shortObjectTreeId(item.id)
  const rowHiddenKind = objectTreeHiddenKind(item)
  const nextVisible = rowHiddenKind === 'period' ? true : !item.manualVisible
  return (
    <div className="ff-object-tree-row" data-kind="drawing" data-selected={selected ? 'true' : undefined} onClick={(event) => event.stopPropagation()}>
      <button
        className="ff-object-tree-row__label-button"
        data-multiselected={selected ? 'true' : undefined}
        data-child={child ? 'true' : undefined}
        onClick={(event) => onSelect(item.id, event.ctrlKey || event.metaKey)}
        title={item.id}
        type="button"
      >
        <span className="ff-object-tree-row__id" title={item.id}>{shortId}</span>
        <span className="ff-object-tree-row__label-text">{item.label}</span>
      </button>
      <button className="ff-object-tree-row__tool" data-hidden-kind={rowHiddenKind} onClick={() => onSetVisible(item.id, targetIds, nextVisible, rowHiddenKind === 'period' && nextVisible)} type="button">{item.visible ? '\u663e\u793a' : '\u9690\u85cf'}</button>
      <button className="ff-object-tree-row__tool" onClick={() => publishObjectTreeDrawingCommand({ action: 'setLocked', id: item.id, ids: targetIds, locked: !item.locked })} type="button">{item.locked ? '\u9501' : '\u5f00'}</button>
      <button className="ff-object-tree-row__tool" onClick={() => publishObjectTreeDrawingCommand({ action: 'delete', id: item.id, ids: targetIds })} type="button">{'\u5220'}</button>
    </div>
  )
}
