export type TwoPointEndpointPressState = {
  overlayId: string
  pointIndex: number
  x: number
  y: number
}

export type TwoPointPressStartEvent = {
  figureIndex?: number
  figureKey?: unknown
  overlay: { id: string }
  x?: number
  y?: number
}

export type TwoPointPressMoveEvent = {
  overlay: {
    extendData?: unknown
    id: string
    lock?: boolean
  }
  x?: number
  y?: number
}

export function resolveTwoPointEndpointPressStart(event: TwoPointPressStartEvent): TwoPointEndpointPressState | null {
  const figureKey = typeof event.figureKey === 'string' ? event.figureKey : ''
  if (!figureKey.includes('point_')) return null
  const pointKeyMatch = /point_(\d+)/.exec(figureKey)
  const pointIndex = Number.isInteger(event.figureIndex)
    ? event.figureIndex
    : pointKeyMatch
      ? Number(pointKeyMatch[1])
      : undefined
  if (typeof pointIndex !== 'number' || !Number.isInteger(pointIndex)) return null
  return {
    overlayId: event.overlay.id,
    pointIndex,
    x: Number(event.x),
    y: Number(event.y),
  }
}

export function isTwoPointEndpointFigureKey(figureKey: unknown) {
  return typeof figureKey === 'string' && figureKey.includes('point_')
}

export function shouldActivateTwoPointEndpointDrag({
  event,
  pending,
  threshold,
}: {
  event: TwoPointPressMoveEvent
  pending: TwoPointEndpointPressState | null
  threshold: number
}) {
  if (!pending || pending.overlayId !== event.overlay.id) return false
  if (event.overlay.lock === true || (event.overlay.extendData as { locked?: boolean } | null)?.locked === true) return false
  const distance = Math.hypot(Number(event.x) - pending.x, Number(event.y) - pending.y)
  return Number.isFinite(distance) && distance >= threshold
}

