import type { StoredFibRetracementDrawing, StoredHorizontalLineDrawing, StoredRulerDrawing, StoredTrendLineDrawing } from '../rightDrawer/drawingObjectPersistence'
import type { StoredEmojiStickerDrawing } from '../rightDrawer/stickerDrawingPersistence'

let horizontalLineObjectIdSeed = 0
let trendLineObjectIdSeed = 0
let rulerObjectIdSeed = 0
let fibRetracementObjectIdSeed = 0
let emojiStickerObjectIdSeed = 0

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

export function createFibRetracementObjectId() {
  fibRetracementObjectIdSeed += 1
  return `FB${String(fibRetracementObjectIdSeed).padStart(4, '0')}`
}

export function createEmojiStickerObjectId() {
  emojiStickerObjectIdSeed += 1
  return `ES${String(emojiStickerObjectIdSeed).padStart(4, '0')}`
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

export function syncFibRetracementObjectIdSeed(drawings: StoredFibRetracementDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericFibRetracementObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) fibRetracementObjectIdSeed = Math.max(fibRetracementObjectIdSeed, value)
  })
}

export function syncEmojiStickerObjectIdSeed(drawings: StoredEmojiStickerDrawing[]) {
  drawings.forEach((drawing) => {
    const value = numericEmojiStickerObjectIdValue(drawing.objectId)
    if (Number.isFinite(value)) emojiStickerObjectIdSeed = Math.max(emojiStickerObjectIdSeed, value)
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

function numericFibRetracementObjectIdValue(objectId: string) {
  const match = /^FB(\d+)$/i.exec(objectId.trim())
  return match ? Number(match[1]) : Number.NaN
}

function numericEmojiStickerObjectIdValue(objectId: string) {
  const match = /^ES(\d+)$/i.exec(objectId.trim())
  return match ? Number(match[1]) : Number.NaN
}
