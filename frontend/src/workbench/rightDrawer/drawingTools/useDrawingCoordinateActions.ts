import type { Dispatch, SetStateAction } from 'react'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'
import { publishDrawingToolCommand } from '../drawingToolCommands'

export function useDrawingCoordinateActions({
  selectedKey,
  setSelectedDrawing,
}: {
  selectedKey: DrawingToolKey
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
}) {
  function setSelectedPrice(price: number) {
    if (selectedKey !== 'horizontalLine') return
    setSelectedDrawing((current) => current?.tool === 'horizontalLine'
      ? { ...current, price }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedPrice',
      price,
      tool: 'horizontalLine',
    })
  }

  function setSelectedTrendPointPrice(pointIndex: number, price: number) {
    if (selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') return
    setSelectedDrawing((current) => current?.tool === selectedKey
      ? {
          ...current,
          trendPointPrices: pointIndex === 0
            ? [price, current.trendPointPrices?.[1]]
            : [current.trendPointPrices?.[0], price],
        }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedTrendLinePointPrice',
      pointIndex,
      price,
      tool: selectedKey,
    })
  }

  return {
    setSelectedPrice,
    setSelectedTrendPointPrice,
  }
}
