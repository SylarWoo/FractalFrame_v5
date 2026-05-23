import type { StoredHorizontalLineDrawing, StoredTrendLineDrawing } from '../rightDrawer/drawingPersistence'

let horizontalLineObjectIdSeed = 0
let trendLineObjectIdSeed = 0

export function createHorizontalLineObjectId() {
  horizontalLineObjectIdSeed += 1
  return `HL${String(horizontalLineObjectIdSeed).padStart(4, '0')}`
}

export function syncHorizontalLineObjectIdSeed(drawings: StoredHorizontalLineDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) horizontalLineObjectIdSeed = Math.max(horizontalLineObjectIdSeed, value)
  })
}

export function createTrendLineObjectId() {
  trendLineObjectIdSeed += 1
  return `TL${String(trendLineObjectIdSeed).padStart(4, '0')}`
}

export function syncTrendLineObjectIdSeed(drawings: StoredTrendLineDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericTrendLineObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) trendLineObjectIdSeed = Math.max(trendLineObjectIdSeed, value)
  })
}

function numericObjectIdValue(objectId: string) {
  const match = /^HL(\d+)$/i.exec(objectId.trim())
  return match ? Number(match[1]) : Number.NaN
}

function numericTrendLineObjectIdValue(objectId: string) {
  const match = /^TL(\d+)$/i.exec(objectId.trim())
  return match ? Number(match[1]) : Number.NaN
}
