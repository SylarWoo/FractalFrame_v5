import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  objectTreeDrawingsChangedEvent,
  publishObjectTreeDrawingCommand,
  requestObjectTreeDrawings,
  type ObjectTreeDrawingItem,
} from './objectTreeModel'
import './ObjectTreeDrawer.css'

type ObjectTreeGroup = {
  id: string
  itemIds: string[]
  name: string
  paneId: string
}

const mainPaneId = 'candle_pane'

export function ObjectTreeDrawer() {
  const [drawingItems, setDrawingItems] = useState<ObjectTreeDrawingItem[]>([])
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  const [groups, setGroups] = useState<ObjectTreeGroup[]>([])

  useEffect(() => {
    const handleDrawingsChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const items = Array.isArray(event.detail?.items) ? event.detail.items as ObjectTreeDrawingItem[] : []
      setDrawingItems(items)
      setSelectedDrawingIds(items.filter((item) => item.selected).map((item) => item.id))
      setGroups((current) => current
        .map((group) => ({ ...group, itemIds: group.itemIds.filter((id) => items.some((item) => item.id === id)) }))
        .filter((group) => group.itemIds.length > 0))
    }
    window.addEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
    requestObjectTreeDrawings()
    return () => window.removeEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
  }, [])

  const mainDrawings = drawingItems.filter((item) => item.paneId === mainPaneId)
  const subPaneDrawings = drawingItems.filter((item) => item.paneId !== mainPaneId)
  const subPaneIds = useMemo(() => Array.from(new Set(subPaneDrawings.map((item) => item.paneId))), [subPaneDrawings])
  const selectedDrawings = drawingItems.filter((item) => selectedDrawingIds.includes(item.id))
  const canGroup = selectedDrawings.length > 1 && selectedDrawings.every((item) => item.paneId === selectedDrawings[0]?.paneId)

  const selectDrawing = (id: string, additive: boolean) => {
    setSelectedDrawingIds((current) => additive
      ? current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
      : [id])
    publishObjectTreeDrawingCommand({ action: 'select', additive, id })
  }

  const clearSelection = () => {
    setSelectedDrawingIds([])
    publishObjectTreeDrawingCommand({ action: 'deselectAll' })
  }

  const groupSelectedDrawings = () => {
    if (!canGroup || !selectedDrawings[0]) return
    const itemIds = selectedDrawings.map((item) => item.id)
    setGroups((current) => [
      ...current.filter((group) => !group.itemIds.some((id) => itemIds.includes(id))),
      {
        id: `group-${Date.now()}`,
        itemIds,
        name: `\u7ec4 ${current.length + 1}`,
        paneId: selectedDrawings[0].paneId,
      },
    ])
    setSelectedDrawingIds([])
  }

  return (
    <section className="ff-object-tree-drawer" data-right-widget-panel="object-tree" onClick={clearSelection}>
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
          <DrawingRows drawings={mainDrawings} groups={groups.filter((group) => group.paneId === mainPaneId)} selectedIds={selectedDrawingIds} onSelect={selectDrawing} />
        </ObjectTreeSection>

        <div className="ff-object-tree-separator" />

        {subPaneIds.map((paneId) => (
          <ObjectTreeSection key={paneId} title={'\u526f\u56fe'}>
            <DrawingRows drawings={subPaneDrawings.filter((item) => item.paneId === paneId)} groups={groups.filter((group) => group.paneId === paneId)} selectedIds={selectedDrawingIds} onSelect={selectDrawing} />
          </ObjectTreeSection>
        ))}
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
  onSelect,
  selectedIds,
}: {
  drawings: ObjectTreeDrawingItem[]
  groups: ObjectTreeGroup[]
  onSelect: (id: string, additive: boolean) => void
  selectedIds: string[]
}) {
  const groupedIds = new Set(groups.flatMap((group) => group.itemIds))
  const ungrouped = drawings.filter((item) => !groupedIds.has(item.id))
  return (
    <>
      {groups.map((group) => (
        <div className="ff-object-tree-group" key={group.id}>
          <div className="ff-object-tree-row" data-kind="group">
            <span className="ff-object-tree-row__label">{group.name}</span>
          </div>
          {drawings.filter((item) => group.itemIds.includes(item.id)).map((item) => (
            <DrawingRow child key={item.id} item={item} selected={selectedIds.includes(item.id)} onSelect={onSelect} />
          ))}
        </div>
      ))}
      {ungrouped.map((item) => (
        <DrawingRow key={item.id} item={item} selected={selectedIds.includes(item.id)} onSelect={onSelect} />
      ))}
    </>
  )
}

function DrawingRow({
  child,
  item,
  onSelect,
  selected,
}: {
  child?: boolean
  item: ObjectTreeDrawingItem
  onSelect: (id: string, additive: boolean) => void
  selected: boolean
}) {
  return (
    <div className="ff-object-tree-row" data-kind="drawing" data-selected={item.selected ? 'true' : undefined} onClick={(event) => event.stopPropagation()}>
      <button
        className="ff-object-tree-row__label-button"
        data-multiselected={selected ? 'true' : undefined}
        data-child={child ? 'true' : undefined}
        onClick={(event) => onSelect(item.id, event.ctrlKey || event.metaKey)}
        type="button"
      >
        {item.label}
      </button>
      <button className="ff-object-tree-row__tool" onClick={() => publishObjectTreeDrawingCommand({ action: 'setVisible', id: item.id, visible: !item.visible })} type="button">{item.visible ? '\u663e\u793a' : '\u9690\u85cf'}</button>
      <button className="ff-object-tree-row__tool" onClick={() => publishObjectTreeDrawingCommand({ action: 'setLocked', id: item.id, locked: !item.locked })} type="button">{item.locked ? '\u9501' : '\u5f00'}</button>
      <button className="ff-object-tree-row__tool" onClick={() => publishObjectTreeDrawingCommand({ action: 'delete', id: item.id })} type="button">{'\u5220'}</button>
    </div>
  )
}
