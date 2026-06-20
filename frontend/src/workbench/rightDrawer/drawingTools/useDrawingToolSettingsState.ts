import { useState } from 'react'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingTool } from './drawingTypes'
import {
  createDefaultDrawingLineStyle,
  createDefaultDrawingTextStyle,
  readDrawingLineStyle,
  readDrawingPriceLabel,
  readDrawingTextStyle,
  readDrawingTrendLineStyle,
  type DrawingTextStyle,
  type DrawingTrendLineStyle,
} from '../drawingPersistence'
import { readDrawingObjectPersistence } from '../drawingObjectPersistence'
import { readQuickMeasureEnabled } from '../quickMeasurePersistence'
import { readDrawingRulerStyle, type DrawingRulerStyle } from '../rulerDrawingStyle'

function readInitialPersistedTools(drawingTools: readonly DrawingTool[]) {
  return Object.fromEntries(
    drawingTools.map((tool) => [
      tool.key,
      tool.key === 'horizontalLine' || tool.key === 'trendLine' || tool.key === 'ruler' || tool.key === 'fibRetracement' || tool.key === 'emojiSticker'
        ? readDrawingObjectPersistence(tool.key)
        : false,
    ]),
  )
}

function readInitialPriceLabelTools(drawingTools: readonly DrawingTool[], storagePeriod: string) {
  return Object.fromEntries(
    drawingTools.map((tool) => [tool.key, readDrawingPriceLabel(tool.key, storagePeriod)]),
  )
}

function readInitialLineStyles(storagePeriod: string) {
  return {
    fibRetracement: readDrawingLineStyle('fibRetracement', createDefaultDrawingLineStyle('#787b86'), storagePeriod),
    horizontalLine: readDrawingLineStyle('horizontalLine', createDefaultDrawingLineStyle('#0f766e'), storagePeriod),
    ruler: readDrawingLineStyle('ruler', createDefaultDrawingLineStyle('#2962ff'), storagePeriod),
    trendLine: readDrawingLineStyle('trendLine', createDefaultDrawingLineStyle('#2962ff'), storagePeriod),
  }
}

function readInitialTextStyles(storagePeriod: string) {
  const trendLineTextStyle = readDrawingTextStyle('trendLine', storagePeriod)
  const defaultTrendLineTextStyle: DrawingTextStyle = { ...createDefaultDrawingTextStyle(), alignH: 'center' }
  return {
    emojiSticker: { ...createDefaultDrawingTextStyle(), body: '', fontSize: 28, textColor: '#111827' },
    fibRetracement: createDefaultDrawingTextStyle(),
    horizontalLine: readDrawingTextStyle('horizontalLine', storagePeriod),
    ruler: readDrawingTextStyle('ruler', storagePeriod),
    trendLine: trendLineTextStyle.body ? trendLineTextStyle : defaultTrendLineTextStyle,
  }
}

export function useDrawingToolSettingsState({
  drawingTools,
  storagePeriod,
}: {
  drawingTools: readonly DrawingTool[]
  storagePeriod: string
}) {
  const [persistedTools, setPersistedTools] = useState<Record<string, boolean>>(() => readInitialPersistedTools(drawingTools))
  const [lockedTools, setLockedTools] = useState<Record<string, boolean>>({})
  const [priceLabelTools, setPriceLabelTools] = useState<Record<string, boolean>>(() => readInitialPriceLabelTools(drawingTools, storagePeriod))
  const [lineStyles, setLineStyles] = useState<Record<string, SettingsLineSwatchValue>>(() => readInitialLineStyles(storagePeriod))
  const [textStyles, setTextStyles] = useState<Record<string, DrawingTextStyle>>(() => readInitialTextStyles(storagePeriod))
  const [trendLineStyle, setTrendLineStyle] = useState<DrawingTrendLineStyle>(() => readDrawingTrendLineStyle(storagePeriod))
  const [rulerStyle, setRulerStyle] = useState<DrawingRulerStyle>(() => readDrawingRulerStyle(storagePeriod))
  const [quickMeasureEnabled, setQuickMeasureEnabled] = useState(() => readQuickMeasureEnabled(storagePeriod))

  return {
    lineStyles,
    lockedTools,
    persistedTools,
    priceLabelTools,
    quickMeasureEnabled,
    rulerStyle,
    setLineStyles,
    setLockedTools,
    setPersistedTools,
    setPriceLabelTools,
    setQuickMeasureEnabled,
    setRulerStyle,
    setTextStyles,
    setTrendLineStyle,
    textStyles,
    trendLineStyle,
  }
}
