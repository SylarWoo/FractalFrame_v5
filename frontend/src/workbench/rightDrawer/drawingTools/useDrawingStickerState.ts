import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SettingsSwatchValue } from '../../settings/SettingsSwatches'
import {
  normalizeDrawingTextStyle,
  type DrawingTextStyle,
} from '../drawingPersistence'
import type { SelectedDrawingState } from './drawingTypes'
import { publishDrawingToolCommand } from '../drawingToolCommands'
import type { StickerIconCategoryKey } from '../StickerStylePanel'

function normalizeStickerSizeInput(value: unknown) {
  const size = Number(value)
  return Number.isFinite(size) ? Math.max(12, Math.min(Math.round(size), 96)) : 28
}

export function useDrawingStickerState({
  selectedLocked,
  setSelectedDrawing,
  setTextStyles,
  textStyles,
}: {
  selectedLocked: boolean
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  setTextStyles: Dispatch<SetStateAction<Record<string, DrawingTextStyle>>>
  textStyles: Record<string, DrawingTextStyle>
}) {
  const [selectedStickerIconCategory, setSelectedStickerIconCategory] = useState<StickerIconCategoryKey>('arrows')
  const [selectedEmoji, setSelectedEmoji] = useState('\u25c6')
  const [stickerColor, setStickerColor] = useState('#111827')
  const [stickerSize, setStickerSize] = useState(28)

  function updateSelectedStickerStyle(next: { bold?: boolean; clearText?: boolean; color?: string; fontFamily?: string; italic?: boolean; size?: number; symbol?: string; textStyle?: DrawingTextStyle }) {
    const nextColor = next.color ?? stickerColor
    const nextSize = normalizeStickerSizeInput(next.size ?? stickerSize)
    const nextSymbol = next.symbol ?? selectedEmoji
    const nextTextStyle = next.textStyle ?? normalizeDrawingTextStyle(textStyles.emojiSticker)
    setStickerColor(nextColor)
    setStickerSize(nextSize)
    setSelectedEmoji(nextSymbol)
    setSelectedDrawing((current) => current?.tool === 'emojiSticker'
      ? { ...current, stickerColor: nextColor, stickerSize: nextSize, stickerSymbol: nextSymbol }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedStickerStyle',
      locked: selectedLocked,
      stickerBold: next.bold ?? nextTextStyle.bold,
      stickerColor: nextColor,
      stickerFontFamily: next.fontFamily ?? nextTextStyle.fontFamily,
      stickerItalic: next.italic ?? nextTextStyle.italic,
      stickerSize: nextSize,
      stickerSymbol: nextSymbol,
      textStyle: next.clearText ? { ...nextTextStyle, body: '' } : next.textStyle,
      tool: 'emojiSticker',
    })
  }

  function setSelectedStickerColor(value: SettingsSwatchValue) {
    updateSelectedStickerStyle({ color: value.hex })
  }

  function setSelectedStickerSize(value: number) {
    updateSelectedStickerStyle({ size: value })
  }

  function setSelectedStickerSymbol(symbol: string) {
    setTextStyles((current) => ({
      ...current,
      emojiSticker: normalizeDrawingTextStyle({ ...current.emojiSticker, body: '' }),
    }))
    updateSelectedStickerStyle({ clearText: true, symbol })
  }

  return {
    selectedEmoji,
    selectedStickerIconCategory,
    setSelectedEmoji,
    setSelectedStickerColor,
    setSelectedStickerIconCategory,
    setSelectedStickerSize,
    setSelectedStickerSymbol,
    setStickerColor,
    setStickerSize,
    stickerColor,
    stickerSize,
    updateSelectedStickerStyle,
  }
}
