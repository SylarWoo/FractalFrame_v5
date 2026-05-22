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
}

export function VisibilityRangePanel({ storageKey }: VisibilityRangePanelProps) {
  const resolvedStorageKey = useMemo(() => visibilityRangeStorageKey(storageKey), [storageKey])
  const [rows, setRows] = useState<VisibilityRangeRow[]>(() => readVisibilityRangeRows(storageKey))

  useEffect(() => {
    setRows(readVisibilityRangeRows(storageKey))
  }, [resolvedStorageKey, storageKey])

  useEffect(() => {
    if (resolvedStorageKey) writeVisibilityRangeRows(storageKey, rows)
  }, [resolvedStorageKey, rows, storageKey])

  const patchRow = (key: VisibilityRangeUnitKey, patch: Partial<VisibilityRangeRow>) => {
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row
      const from = patch.from == null ? row.from : clampVisibilityRangeValue(patch.from, row.min, row.max)
      const to = patch.to == null ? row.to : clampVisibilityRangeValue(patch.to, row.min, row.max)
      return {
        ...row,
        ...patch,
        from: Math.min(from, to),
        to: Math.max(from, to),
      }
    }))
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
