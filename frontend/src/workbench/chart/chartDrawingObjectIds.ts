import type { StoredHorizontalLineDrawing, StoredRulerDrawing, StoredTrendLineDrawing } from '../rightDrawer/drawingObjectPersistence'

let horizontalLineObjectIdSeed = 0
let trendLineObjectIdSeed = 0
let rulerObjectIdSeed = 0

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

export function createRulerObjectId() {
  rulerObjectIdSeed += 1
  return `RL${String(rulerObjectIdSeed).padStart(4, '0')}`
}

export function syncTrendLineObjectIdSeed(drawings: StoredTrendLineDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericTrendLineObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) trendLineObjectIdSeed = Math.max(trendLineObjectIdSeed, value)
  })
}

export function syncRulerObjectIdSeed(drawings: StoredRulerDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericRulerObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) rulerObjectIdSeed = Math.max(rulerObjectIdSeed, value)
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

function numericRulerObjectIdValue(objectId: string) {
  const match = /^RL(\d+)$/i.exec(objectId.trim())
  return match ? Number(match[1]) : Number.NaN
}
