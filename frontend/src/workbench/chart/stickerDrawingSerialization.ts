import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { StoredEmojiStickerDrawing } from '../rightDrawer/stickerDrawingPersistence'

type StickerOverlayLike = {
  extendData?: unknown
  paneId?: string
  points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
}

export function storedEmojiStickerFromOverlay(overlay: StickerOverlayLike, ensureObjectId: () => string, fallbackPaneId: string): StoredEmojiStickerDrawing | null {
  const point = normalizeStoredStickerPoint(overlay.points[0] ?? {})
  if (typeof point.value !== 'number') return null
  const extendData = overlay.extendData as {
    bold?: boolean
    color?: string
    fontFamily?: string
    italic?: boolean
    locked?: boolean
    manualVisible?: boolean
    objectId?: string
    size?: number
    symbol?: string
    textStyle?: Partial<DrawingTextStyle>
  } | undefined
  const textStyle = normalizeDrawingTextStyle(extendData?.textStyle)
  return {
    bold: extendData?.bold === true,
    color: typeof extendData?.color === 'string' && extendData.color.trim() ? extendData.color.trim() : textStyle.textColor,
    fontFamily: typeof extendData?.fontFamily === 'string' && extendData.fontFamily.trim() ? extendData.fontFamily.trim() : textStyle.fontFamily,
    italic: extendData?.italic === true,
    locked: extendData?.locked === true,
    manualVisible: extendData?.manualVisible !== false,
    objectId: extendData?.objectId || ensureObjectId(),
    paneId: overlay.paneId || fallbackPaneId,
    point,
    size: typeof extendData?.size === 'number' && Number.isFinite(extendData.size) ? extendData.size : textStyle.fontSize,
    symbol: typeof extendData?.symbol === 'string' && extendData.symbol ? extendData.symbol : textStyle.body || '\u25c6',
    textStyle,
  }
}

function normalizeStoredStickerPoint(point: { dataIndex?: number; timestamp?: number; value?: number }) {
  const dataIndex = Number(point?.dataIndex)
  const timestamp = Number(point?.timestamp)
  const value = Number(point?.value)
  return {
    ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
    ...(Number.isFinite(value) ? { value } : {}),
  }
}
