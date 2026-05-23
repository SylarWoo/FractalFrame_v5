import { useEffect, useMemo, useState } from 'react'
import {
  clampVisibilityRangeValue,
  readVisibilityRangeRows,
  type VisibilityRangeRow,
  type VisibilityRangeUnitKey,
  visibilityRangeStorageKey,
  writeVisibilityRangeRows,
} from './visibilityRangeModel'
import './VisibilityRangePanel.css'

type VisibilityRangePanelProps = {
  storageKey?: string
  storageKeys?: string[]
}

export function VisibilityRangePanel({ storageKey, storageKeys }: VisibilityRangePanelProps) {
  const effectiveStorageKeys = useMemo(() => {
    const keys = storageKeys && storageKeys.length > 0 ? storageKeys : storageKey ? [storageKey] : []
    return Array.from(new Set(keys.filter((key) => typeof key === 'string' && key.trim().length > 0)))
  }, [storageKey, storageKeys])
  const primaryStorageKey = effectiveStorageKeys[0]
  const resolvedStorageKey = useMemo(() => visibilityRangeStorageKey(primaryStorageKey), [primaryStorageKey])
  const resolvedStorageKeys = useMemo(() => effectiveStorageKeys.map((key) => visibilityRangeStorageKey(key)).join('|'), [effectiveStorageKeys])
  const [rows, setRows] = useState<VisibilityRangeRow[]>(() => readVisibilityRangeRows(primaryStorageKey))

  useEffect(() => {
    setRows(readVisibilityRangeRows(primaryStorageKey))
  }, [primaryStorageKey, resolvedStorageKey, resolvedStorageKeys])

  const patchRow = (key: VisibilityRangeUnitKey, patch: Partial<VisibilityRangeRow>) => {
    const nextRows = rows.map((row) => {
      if (row.key !== key) return row
      const from = patch.from == null ? row.from : clampVisibilityRangeValue(patch.from, row.min, row.max)
      const to = patch.to == null ? row.to : clampVisibilityRangeValue(patch.to, row.min, row.max)
      return {
        ...row,
        ...patch,
        from: Math.min(from, to),
        to: Math.max(from, to),
      }
    })
    setRows(nextRows)
    effectiveStorageKeys.forEach((storageKey) => writeVisibilityRangeRows(storageKey, nextRows))
  }

  return (
    <div className="ff-visibility-range-panel" role="group" aria-label="Visibility range">
      {rows.map((row) => (
        <VisibilityRangeRowView key={row.key} row={row} onChange={(patch) => patchRow(row.key, patch)} />
      ))}
    </div>
  )
}

function VisibilityRangeRowView({
  onChange,
  row,
}: {
  onChange: (patch: Partial<VisibilityRangeRow>) => void
  row: VisibilityRangeRow
}) {
  const disabled = !row.enabled

  return (
    <div className="ff-visibility-range-row" data-disabled={disabled ? 'true' : undefined}>
      <label className="ff-visibility-range-row__check">
        <input checked={row.enabled} onChange={(event) => onChange({ enabled: event.currentTarget.checked })} type="checkbox" />
        <span>{row.label}</span>
      </label>
      <input
        className="ff-visibility-range-row__number"
        disabled={disabled}
        max={row.max}
        min={row.min}
        onChange={(event) => onChange({ from: Number(event.currentTarget.value) })}
        type="number"
        value={row.from}
      />
      <span className="ff-visibility-range-row__separator">~</span>
      <input
        className="ff-visibility-range-row__number"
        disabled={disabled}
        max={row.max}
        min={row.min}
        onChange={(event) => onChange({ to: Number(event.currentTarget.value) })}
        type="number"
        value={row.to}
      />
    </div>
  )
}
