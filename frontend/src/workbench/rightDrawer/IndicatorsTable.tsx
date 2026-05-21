import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export type IndicatorTableRow = {
  key: string
  name: string
  type: string
  description: string
}

type IndicatorColumnKey = 'indicator' | 'name' | 'type' | 'description'
type IndicatorColumnWidths = Record<IndicatorColumnKey, number>

const defaultColumnWidths: IndicatorColumnWidths = {
  indicator: 76,
  name: 116,
  type: 64,
  description: 202,
}

const minColumnWidths: IndicatorColumnWidths = {
  indicator: 62,
  name: 74,
  type: 54,
  description: 120,
}

type IndicatorsTableProps = {
  indicatorShortcutKeys: string[]
  rows: IndicatorTableRow[]
  selectedKey: string
  onIndicatorShortcutKeysChange: (keys: string[]) => void
  onSelect: (key: string) => void
}

export function IndicatorsTable({
  indicatorShortcutKeys,
  rows,
  selectedKey,
  onIndicatorShortcutKeysChange,
  onSelect,
}: IndicatorsTableProps) {
  const [columnWidths, setColumnWidths] = useState<IndicatorColumnWidths>(defaultColumnWidths)

  function handleIndicatorCheckedChange(key: string, checked: boolean) {
    onSelect(key)
    if (checked) {
      onIndicatorShortcutKeysChange(indicatorShortcutKeys.includes(key) ? indicatorShortcutKeys : [...indicatorShortcutKeys, key])
      return
    }
    onIndicatorShortcutKeysChange(indicatorShortcutKeys.filter((item) => item !== key))
  }

  function handleColumnResizePointerDown(event: ReactPointerEvent<HTMLSpanElement>, column: IndicatorColumnKey) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeIndicatorsColumnResizing = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX)
      setColumnWidths((current) => ({
        ...current,
        [column]: Math.max(minColumnWidths[column], Math.round(nextWidth)),
      }))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-indicators-column-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  function resetColumnWidth(column: IndicatorColumnKey) {
    setColumnWidths((current) => ({ ...current, [column]: defaultColumnWidths[column] }))
  }

  function renderResizableHeader(label: string, column: IndicatorColumnKey, resizable = true) {
    return (
      <th scope="col">
        {label}
        {resizable ? (
          <span
            className="ff-indicators-table-v1__column-resizer"
            onDoubleClick={() => resetColumnWidth(column)}
            onPointerDown={(event) => handleColumnResizePointerDown(event, column)}
          />
        ) : null}
      </th>
    )
  }

  return (
    <div className="ff-indicators-split-v1__top" data-ff-indicators-split-top-v1>
      <table className="right-widget-drawer__table ff-indicators-table-v1" aria-label="Indicators list">
        <colgroup>
          <col style={{ width: `${columnWidths.indicator}px` }} />
          <col style={{ width: `${columnWidths.name}px` }} />
          <col style={{ width: `${columnWidths.type}px` }} />
          <col style={{ width: `${columnWidths.description}px` }} />
        </colgroup>
        <thead>
          <tr>
            {renderResizableHeader('Indicators', 'indicator')}
            {renderResizableHeader('中文名称', 'name')}
            {renderResizableHeader('类型', 'type')}
            {renderResizableHeader('描述', 'description', false)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const inShortcutMenu = indicatorShortcutKeys.includes(row.key)
            return (
              <tr
                data-ff-indicator-row-v1={row.key}
                data-selected={selectedKey === row.key}
                key={row.key}
                onClick={() => onSelect(row.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(row.key)
                  }
                }}
                tabIndex={0}
              >
                <td>
                  <span className="ff-indicators-table-v1__check">
                    <input
                      aria-label={`${row.key} shortcut`}
                      checked={inShortcutMenu}
                      onChange={(event) => handleIndicatorCheckedChange(row.key, event.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      type="checkbox"
                    />
                    <span>{row.key}</span>
                  </span>
                </td>
                <td>{row.name}</td>
                <td>{row.type}</td>
                <td title={row.description}>{row.description}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
