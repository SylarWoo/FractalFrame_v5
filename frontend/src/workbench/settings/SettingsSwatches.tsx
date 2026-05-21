import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { openChartColorPalettePopoverV1 } from '../rightDrawer/color_palette/chartColorPalettePopoverV1.js'
import { readSettingsSymbolState, settingsSymbolChangedEvent, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import './SettingsSharedControls.css'

export type SettingsSwatchValue = {
  hex: string
  opacity: number
}

export type SettingsLineSwatchValue = SettingsSwatchValue & {
  lineStyle: 'solid' | 'dashed' | 'dotted'
  thickness: number
}

export type SettingsLineWeightValue = {
  opacity: number
  thickness: number
}

function resolveHexRgbString(hex: string) {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return '38, 166, 154'
  const value = Number.parseInt(normalized, 16)
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`
}

function normalizeSettingsLineStyle(value: unknown): SettingsLineSwatchValue['lineStyle'] {
  return value === 'dashed' || value === 'dotted' ? value : 'solid'
}

function normalizeSwatchHex(hex: string) {
  return hex.trim().toLowerCase()
}

function sameSettingsSwatchValue(a: SettingsSwatchValue, b: SettingsSwatchValue) {
  return normalizeSwatchHex(a.hex) === normalizeSwatchHex(b.hex) && Math.abs(a.opacity - b.opacity) < 0.001
}

function sameSettingsLineSwatchValue(a: SettingsLineSwatchValue, b: SettingsLineSwatchValue) {
  return sameSettingsSwatchValue(a, b) && a.lineStyle === b.lineStyle && a.thickness === b.thickness
}

function sameSettingsLineWeightValue(a: SettingsLineWeightValue, b: SettingsLineWeightValue) {
  return Math.abs(a.opacity - b.opacity) < 0.001 && a.thickness === b.thickness
}

let activeSettingsColorPopoverClose: (() => void) | null = null

function readSettingsSwatchValue(storageKey: string | undefined, fallbackHex: string): SettingsSwatchValue {
  if (!storageKey) return { hex: fallbackHex, opacity: 1 }
  const saved = readSettingsSymbolState()[storageKey]
  if (saved && typeof saved === 'object' && 'hex' in saved) {
    const swatch = saved as Partial<SettingsSwatchValue>
    const hex = typeof swatch.hex === 'string' ? swatch.hex : fallbackHex
    const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity) ? swatch.opacity : 1
    return { hex, opacity }
  }
  return { hex: fallbackHex, opacity: 1 }
}

function readSettingsLineSwatchValue(storageKey: string | undefined, fallbackHex: string): SettingsLineSwatchValue {
  const saved = storageKey ? readSettingsSymbolState()[storageKey] : null
  const base = readSettingsSwatchValue(storageKey, fallbackHex)
  const thickness = saved && typeof saved === 'object' && 'thickness' in saved
    ? Number((saved as Partial<SettingsLineSwatchValue>).thickness)
    : 1
  const lineStyle = saved && typeof saved === 'object' && 'lineStyle' in saved
    ? (saved as Partial<SettingsLineSwatchValue>).lineStyle
    : 'solid'
  return {
    ...base,
    lineStyle: normalizeSettingsLineStyle(lineStyle),
    thickness: Number.isFinite(thickness) ? Math.max(1, Math.min(Math.round(thickness), 4)) : 1,
  }
}

function resolveSwatchColorForSettings(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as Partial<SettingsSwatchValue>
  return typeof swatch.hex === 'string' ? swatch.hex : fallback
}

function readCandleBodyPreviewColors() {
  const state = readSettingsSymbolState()
  return {
    up: resolveSwatchColorForSettings(state['candle.body.up'], '#26a69a'),
    down: resolveSwatchColorForSettings(state['candle.body.down'], '#ef5350'),
  }
}

export function SettingsColorSwatch({
  color,
  checkerboard = false,
  onChange,
  storageKey,
  value: controlledValue,
}: {
  color?: string
  checkerboard?: boolean
  onChange?: (value: SettingsSwatchValue) => void
  storageKey?: string
  value?: SettingsSwatchValue
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(() => readSettingsSwatchValue(storageKey, color ?? '#26a69a'))
  const displayValue = controlledValue ?? value
  const latestValueRef = useRef(displayValue)
  const isTransparent = displayValue.opacity < 0.999
  const isWhite = /^#(?:fff|ffffff)$/i.test(displayValue.hex.trim())

  useEffect(() => {
    latestValueRef.current = displayValue
  }, [displayValue])

  return (
    <button
      aria-label="Color"
      className="ff-settings-color-swatch ff-openable-control"
      data-checkerboard={checkerboard}
      data-light={isWhite}
      data-transparent={isTransparent}
      onClick={(event) => {
        event.stopPropagation()
        const anchorEl = buttonRef.current
        if (!anchorEl) return
        if (anchorEl.getAttribute('data-open') === 'true') {
          activeSettingsColorPopoverClose?.()
          activeSettingsColorPopoverClose = null
          return
        }
        const popover = openChartColorPalettePopoverV1({
          doc: document,
          anchorEl,
          initialHex: displayValue.hex,
          initialOpacity: displayValue.opacity,
          showCustomColorsRow: true,
          showCustomPicker: true,
          showOpacity: true,
          onPick: (payload) => {
            if (typeof payload?.hex === 'string') {
              const nextValue = {
                hex: payload.hex,
                opacity: typeof payload.opacity === 'number' && Number.isFinite(payload.opacity) ? payload.opacity : 1,
              }
              if (sameSettingsSwatchValue(nextValue, latestValueRef.current)) return
              latestValueRef.current = nextValue
              setValue(nextValue)
              if (storageKey) writeSettingsSymbolStateValue(storageKey, nextValue)
              onChange?.(nextValue)
            }
          },
        })
        activeSettingsColorPopoverClose = popover.close
      }}
      ref={buttonRef}
      style={{
        '--ff-settings-swatch-color': displayValue.hex,
        '--ff-settings-swatch-rgb': resolveHexRgbString(displayValue.hex),
        '--ff-settings-swatch-opacity': String(displayValue.opacity),
      } as CSSProperties}
      type="button"
    >
      <span className="ff-settings-color-swatch__inner" />
    </button>
  )
}

export function SettingsLineSwatch({
  color = '#9ca3af',
  inheritCandleColors = false,
  lineStyle = 'solid',
  onChange,
  secondary,
  storageKey,
  thickness = 1,
  value: controlledValue,
}: {
  color?: string
  inheritCandleColors?: boolean
  lineStyle?: SettingsLineSwatchValue['lineStyle']
  onChange?: (value: SettingsLineSwatchValue) => void
  secondary?: string
  storageKey?: string
  thickness?: number
  value?: SettingsLineSwatchValue
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(() => {
    const stored = readSettingsLineSwatchValue(storageKey, color)
    return storageKey ? stored : { ...stored, lineStyle, thickness }
  })
  const [inheritedColors, setInheritedColors] = useState(readCandleBodyPreviewColors)
  const displayValue = controlledValue ?? value
  const latestValueRef = useRef(displayValue)
  const swatchColor = displayValue.hex
  const autoUpColor = inheritCandleColors ? inheritedColors.up : color
  const autoDownColor = inheritCandleColors ? inheritedColors.down : secondary
  const isAuto = (inheritCandleColors || secondary) && !storageKey

  useEffect(() => {
    latestValueRef.current = displayValue
  }, [displayValue])

  useEffect(() => {
    if (!inheritCandleColors) return
    const sync = () => setInheritedColors(readCandleBodyPreviewColors())
    window.addEventListener(settingsSymbolChangedEvent, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, sync)
      window.removeEventListener('storage', sync)
    }
  }, [inheritCandleColors])

  return (
    <button
      aria-label="Line color"
      className="ff-settings-line-swatch ff-openable-control"
      onClick={(event) => {
        event.stopPropagation()
        const anchorEl = buttonRef.current
        if (!anchorEl) return
        if (anchorEl.getAttribute('data-open') === 'true') {
          activeSettingsColorPopoverClose?.()
          activeSettingsColorPopoverClose = null
          return
        }
        const popover = openChartColorPalettePopoverV1({
            doc: document,
            anchorEl,
            initialHex: swatchColor,
            initialOpacity: displayValue.opacity,
            initialLineStyle: displayValue.lineStyle,
            initialThickness: displayValue.thickness,
            showCustomColorsRow: true,
            showCustomPicker: true,
            showLineStyle: true,
            showOpacity: true,
            showThickness: true,
            thicknessSteps: 4,
            onPick: (payload) => {
              if (typeof payload?.hex !== 'string') return
              const currentValue = latestValueRef.current
              const nextValue = {
                hex: payload.hex,
                lineStyle: normalizeSettingsLineStyle(payload.lineStyle),
                opacity: typeof payload.opacity === 'number' && Number.isFinite(payload.opacity) ? payload.opacity : currentValue.opacity,
                thickness: typeof payload.thickness === 'number' && Number.isFinite(payload.thickness)
                  ? Math.max(1, Math.min(Math.round(payload.thickness), 4))
                  : currentValue.thickness,
              }
              if (sameSettingsLineSwatchValue(nextValue, currentValue)) return
              latestValueRef.current = nextValue
              setValue(nextValue)
              if (storageKey) writeSettingsSymbolStateValue(storageKey, nextValue)
              onChange?.(nextValue)
          },
        })
        activeSettingsColorPopoverClose = popover.close
      }}
      ref={buttonRef}
      type="button"
    >
      <span
        className="ff-settings-line-swatch__chip"
        style={
          isAuto
            ? { background: `linear-gradient(45deg, ${autoUpColor} 0 50%, ${autoDownColor ?? autoUpColor} 50% 100%)` }
            : { background: swatchColor, opacity: displayValue.opacity }
        }
      />
      <span
        className="ff-settings-line-swatch__line"
        data-style={displayValue.lineStyle}
        style={{
          borderTopColor: swatchColor,
          opacity: displayValue.opacity,
          borderTopStyle: displayValue.lineStyle === 'dotted' ? 'dotted' : displayValue.lineStyle === 'dashed' ? 'dashed' : 'solid',
          borderTopWidth: `${displayValue.thickness}px`,
        }}
      />
    </button>
  )
}

export function SettingsLineWeightSwatch({
  color = '#131722',
  onChange,
  opacity = 1,
  thickness = 1,
  value: controlledValue,
}: {
  color?: string
  onChange?: (value: SettingsLineWeightValue) => void
  opacity?: number
  thickness?: number
  value?: SettingsLineWeightValue
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const fallbackValue = {
    opacity: Math.max(0, Math.min(opacity, 1)),
    thickness: Math.max(1, Math.min(Math.round(thickness), 6)),
  }
  const [value, setValue] = useState<SettingsLineWeightValue>(fallbackValue)
  const displayValue = controlledValue ?? value
  const latestValueRef = useRef(displayValue)

  useEffect(() => {
    latestValueRef.current = displayValue
  }, [displayValue])

  return (
    <button
      aria-label="Line opacity and thickness"
      className="ff-settings-line-weight-swatch ff-openable-control"
      onClick={(event) => {
        event.stopPropagation()
        const anchorEl = buttonRef.current
        if (!anchorEl) return
        if (anchorEl.getAttribute('data-open') === 'true') {
          activeSettingsColorPopoverClose?.()
          activeSettingsColorPopoverClose = null
          return
        }
        const popover = openChartColorPalettePopoverV1({
          doc: document,
          anchorEl,
          initialHex: color,
          initialOpacity: displayValue.opacity,
          initialLineStyle: 'solid',
          initialThickness: displayValue.thickness,
          showCustomColorsRow: false,
          showCustomPicker: false,
          showLineStyle: false,
          showOpacity: true,
          showPresetGrid: false,
          showThickness: true,
          thicknessSteps: 6,
          onPick: (payload) => {
            const currentValue = latestValueRef.current
            const nextValue = {
              opacity: typeof payload?.opacity === 'number' && Number.isFinite(payload.opacity) ? payload.opacity : currentValue.opacity,
              thickness: typeof payload?.thickness === 'number' && Number.isFinite(payload.thickness)
                ? Math.max(1, Math.min(Math.round(payload.thickness), 6))
                : currentValue.thickness,
            }
            if (sameSettingsLineWeightValue(nextValue, currentValue)) return
            latestValueRef.current = nextValue
            setValue(nextValue)
            onChange?.(nextValue)
          },
        })
        activeSettingsColorPopoverClose = popover.close
      }}
      ref={buttonRef}
      type="button"
    >
      <span
        className="ff-settings-line-weight-swatch__line"
        style={{
          borderTopColor: color,
          borderTopWidth: `${displayValue.thickness}px`,
          opacity: displayValue.opacity,
        }}
      />
    </button>
  )
}

export function SettingsColorPair({ left, right }: { left: string; right: string }) {
  return (
    <div className="ff-settings-color-pair">
      <SettingsColorSwatch color={left} storageKey="coordinates.bid.color" />
      <SettingsColorSwatch color={right} storageKey="coordinates.ask.color" />
    </div>
  )
}
