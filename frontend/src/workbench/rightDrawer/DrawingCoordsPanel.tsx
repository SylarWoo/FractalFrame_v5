import { useState } from 'react'
import { formatGlobalPrice } from '../chart/globalPricePrecision'

export type DrawingPriceCoordinate = {
  id: string
  label: string
  onChange: (price: number) => void
  price?: number
}

export function DrawingPriceCoordsPanel({
  coordinates,
  locked,
  lockedMessage,
  notSelectedMessage,
  selected,
}: {
  coordinates: DrawingPriceCoordinate[]
  locked: boolean
  lockedMessage: string
  notSelectedMessage: string
  selected: boolean
}) {
  if (!selected) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{notSelectedMessage}</p>
  }

  if (locked) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{lockedMessage}</p>
  }

  return (
    <div className="ff-drawing-hline-coords-tab-v1">
      {coordinates.map((coordinate) => (
        <DrawingPriceCoordinateRow coordinate={coordinate} key={coordinate.id} />
      ))}
    </div>
  )
}

function DrawingPriceCoordinateRow({ coordinate }: { coordinate: DrawingPriceCoordinate }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const formattedPrice = Number.isFinite(coordinate.price) ? formatGlobalPrice(coordinate.price, '') : ''
  const displayValue = editing ? draft : formattedPrice

  const commit = () => {
    const nextPrice = Number(displayValue.trim().replace(/,/g, ''))
    if (!Number.isFinite(nextPrice)) {
      setDraft(Number.isFinite(coordinate.price) ? formatGlobalPrice(coordinate.price, '') : '')
      setEditing(false)
      return
    }
    coordinate.onChange(nextPrice)
    setDraft(formatGlobalPrice(nextPrice, ''))
    setEditing(false)
  }

  return (
    <div className="ff-drawing-hline-coords-tab-v1__row">
      <label className="ff-drawing-hline-coords-tab-v1__label" htmlFor={coordinate.id}>
        {coordinate.label}
      </label>
      <input
        autoComplete="off"
        className="ff-drawing-hline-coords-tab-v1__input"
        id={coordinate.id}
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => {
          setEditing(true)
          setDraft(Number.isFinite(coordinate.price) ? formatGlobalPrice(coordinate.price, '') : '')
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          commit()
        }}
        step="any"
        type="number"
        value={displayValue}
      />
    </div>
  )
}
