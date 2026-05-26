import { formatGlobalPrice } from '../chart/globalPricePrecision'
import { NumericStepperInput } from '../controls/NumericStepperInput'

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
  return (
    <div className="ff-drawing-hline-coords-tab-v1__row">
      <label className="ff-drawing-hline-coords-tab-v1__label" htmlFor={coordinate.id}>
        {coordinate.label}
      </label>
      <NumericStepperInput
        formatValue={(value) => formatGlobalPrice(value, '')}
        id={coordinate.id}
        inputClassName="ff-drawing-hline-coords-tab-v1__input"
        onChange={coordinate.onChange}
        value={coordinate.price}
      />
    </div>
  )
}
