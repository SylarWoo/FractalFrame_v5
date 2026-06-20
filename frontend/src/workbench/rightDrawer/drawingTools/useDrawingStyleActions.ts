import type { Dispatch, SetStateAction } from 'react'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingTool, DrawingToolKey, SelectedDrawingState } from './drawingTypes'
import {
  normalizeDrawingTextStyle,
  normalizeDrawingTrendLineStyle,
  writeDrawingLineStyle,
  writeDrawingPriceLabel,
  writeDrawingTextStyle,
  writeDrawingTrendLineStyle,
  type DrawingTextStyle,
  type DrawingTrendLineStyle,
} from '../drawingPersistence'
import { publishDrawingToolCommand } from '../drawingToolCommands'
import { normalizeDrawingRulerStyle, writeDrawingRulerStyle, type DrawingRulerStyle } from '../rulerDrawingStyle'
import { writeQuickMeasureEnabled } from '../quickMeasurePersistence'
import {
  applySelectedDrawingPatch,
  createStickerStyleUpdateFromTextStyle,
  isLineStyleCommandTool,
  isTextStyleCommandTool,
  shouldPublishPriceLabelCommand,
} from './drawingStyleActionState'

export function useDrawingStyleActions({
  selectedEmoji,
  selectedDrawing,
  selectedKey,
  selectedTool,
  setLineStyles,
  setPriceLabelTools,
  setQuickMeasureEnabled,
  setRulerStyle,
  setSelectedDrawing,
  setTextStyles,
  setTrendLineStyle,
  storagePeriod,
  updateSelectedStickerStyle,
}: {
  selectedEmoji: string
  selectedDrawing: SelectedDrawingState | null
  selectedKey: DrawingToolKey
  selectedTool: DrawingTool
  setLineStyles: Dispatch<SetStateAction<Record<string, SettingsLineSwatchValue>>>
  setPriceLabelTools: Dispatch<SetStateAction<Record<string, boolean>>>
  setQuickMeasureEnabled: Dispatch<SetStateAction<boolean>>
  setRulerStyle: Dispatch<SetStateAction<DrawingRulerStyle>>
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  setTextStyles: Dispatch<SetStateAction<Record<string, DrawingTextStyle>>>
  setTrendLineStyle: Dispatch<SetStateAction<DrawingTrendLineStyle>>
  storagePeriod: string
  updateSelectedStickerStyle: (next: { bold?: boolean; clearText?: boolean; color?: string; fontFamily?: string; italic?: boolean; size?: number; symbol?: string; textStyle?: DrawingTextStyle }) => void
}) {
  function setSelectedPriceLabel(enabled: boolean) {
    setPriceLabelTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeDrawingPriceLabel(selectedKey, enabled, storagePeriod)
    if (selectedDrawing?.tool === selectedKey) {
      setSelectedDrawing((current) => applySelectedDrawingPatch(current, selectedKey, { showPriceLabel: enabled }))
    }
    if (!shouldPublishPriceLabelCommand(selectedKey, selectedDrawing)) return
    publishDrawingToolCommand({
      action: 'updateSelectedPriceLabel',
      showPriceLabel: enabled,
      tool: selectedKey,
    })
  }

  function setSelectedLineStyle(value: SettingsLineSwatchValue) {
    setLineStyles((current) => ({ ...current, [selectedTool.key]: value }))
    writeDrawingLineStyle(selectedTool.key, value, storagePeriod)
    setSelectedDrawing((current) => applySelectedDrawingPatch(current, selectedKey, { lineStyle: value }))
    if (!isLineStyleCommandTool(selectedKey)) return
    publishDrawingToolCommand({
      action: 'updateSelectedLineStyle',
      lineStyle: value,
      tool: selectedKey,
    })
  }

  function setSelectedTextStyle(value: DrawingTextStyle) {
    const normalized = normalizeDrawingTextStyle(value)
    setTextStyles((current) => ({ ...current, [selectedTool.key]: normalized }))
    if (selectedTool.key !== 'emojiSticker') writeDrawingTextStyle(selectedTool.key, normalized, storagePeriod)
    setSelectedDrawing((current) => applySelectedDrawingPatch(current, selectedKey, { textStyle: normalized }))
    if (selectedKey === 'emojiSticker') {
      updateSelectedStickerStyle(createStickerStyleUpdateFromTextStyle(normalized, selectedEmoji))
      return
    }
    if (!isTextStyleCommandTool(selectedKey)) return
    publishDrawingToolCommand({
      action: 'updateSelectedTextStyle',
      textStyle: normalized,
      tool: selectedKey,
    })
  }

  function setSelectedTrendLineStyle(value: DrawingTrendLineStyle) {
    const normalized = normalizeDrawingTrendLineStyle(value)
    setTrendLineStyle(normalized)
    writeDrawingTrendLineStyle(normalized, storagePeriod)
    publishDrawingToolCommand({
      action: 'updateSelectedTrendLineStyle',
      tool: 'trendLine',
      trendLineStyle: normalized,
    })
  }

  function setSelectedRulerStyle(value: DrawingRulerStyle) {
    const normalized = normalizeDrawingRulerStyle(value)
    setRulerStyle(normalized)
    writeDrawingRulerStyle(normalized, storagePeriod)
    setSelectedDrawing((current) => applySelectedDrawingPatch(current, 'ruler', { rulerStyle: normalized }))
    publishDrawingToolCommand({
      action: 'updateSelectedRulerStyle',
      rulerStyle: normalized,
      tool: 'ruler',
    })
  }

  function setQuickMeasure(nextEnabled: boolean) {
    setQuickMeasureEnabled(nextEnabled)
    writeQuickMeasureEnabled(nextEnabled, storagePeriod)
    publishDrawingToolCommand({
      action: 'updateQuickMeasureEnabled',
      enabled: nextEnabled,
      tool: 'ruler',
    })
  }

  return {
    setQuickMeasure,
    setSelectedLineStyle,
    setSelectedPriceLabel,
    setSelectedRulerStyle,
    setSelectedTextStyle,
    setSelectedTrendLineStyle,
  }
}
