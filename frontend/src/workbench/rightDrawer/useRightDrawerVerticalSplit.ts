import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export function clampRightDrawerSplitHeight(value: number, minHeight: number, maxHeight: number) {
  return Math.max(minHeight, Math.min(maxHeight, Math.round(value)))
}

export function useRightDrawerVerticalSplit(options: {
  bodyDatasetKey: string
  defaultHeight: number
  maxHeight: number
  minHeight: number
}) {
  const [topHeight, setTopHeight] = useState(options.defaultHeight)

  const handleSplitPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset[options.bodyDatasetKey] = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(clampRightDrawerSplitHeight(nextHeight, options.minHeight, options.maxHeight))
    }

    const handlePointerUp = () => {
      delete document.body.dataset[options.bodyDatasetKey]
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

  return {
    handleSplitPointerDown,
    topHeight,
  }
}
