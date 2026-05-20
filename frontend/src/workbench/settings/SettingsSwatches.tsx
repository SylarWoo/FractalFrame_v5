import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { openChartColorPalettePopoverV1 } from '../rightDrawer/color_palette/chartColorPalettePopoverV1.js'
import { readSettingsSymbolState, settingsSymbolChangedEvent, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import './SettingsSharedControls.css'

type SettingsSwatchValue = {
  hex: string
  opacity: number
}

type SettingsLineSwatchValue = SettingsSwatchValue & {
  lineStyle: 'solid' | 'dashed' | 'dotted'
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
  storageKey,
}: {
  color?: string
  checkerboard?: boolean
  storageKey?: string
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(() => readSettingsSwatchValue(storageKey, color ?? '#26a69a'))
  const isTransparent = !checkerboard && value.opacity < 0.999
  const isWhite = /^#(?:fff|ffffff)$/i.test(value.hex.trim())

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
          initialHex: value.hex,
          initialOpacity: value.opacity,
          showCustomColorsRow: true,
          showCustomPicker: true,
          showOpacity: true,
          onPick: (payload) => {
            if (typeof payload?.hex === 'string') {
              const nextValue = {
                hex: payload.hex,
                opacity: typeof payload.opacity === 'number' && Number.isFinite(payload.opacity) ? payload.opacity : 1,
              }
              setValue(nextValue)
              if (storageKey) writeSettingsSymbolStateValue(storageKey, nextValue)
            }
          },
        })
        activeSettingsColorPopoverClose = popover.close
      }}
      ref={buttonRef}
      style={
        checkerboard
          ? undefined
          : ({
              '--ff-settings-swatch-color': value.hex,
              '--ff-settings-swatch-rgb': resolveHexRgbString(value.hex),
              '--ff-settings-swatch-opacity': String(value.opacity),
            } as CSSProperties)
      }
      type="button"
    >
      <span className="ff-settings-color-swatch__inner" />
    </button>
  )
}

export function SettingsLineSwatch({
  color = '#9ca3af',
  inheritCandleColors = false,
  secondary,
  storageKey,
}: {
  color?: string
  inheritCandleColors?: boolean
  secondary?: string
  storageKey?: string
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [value, setValue] = useState(() => readSettingsLineSwatchValue(storageKey, color))
  const [inheritedColors, setInheritedColors] = useState(readCandleBodyPreviewColors)
  const swatchColor = value.hex
  const autoUpColor = inheritCandleColors ? inheritedColors.up : color
  const autoDownColor = inheritCandleColors ? inheritedColors.down : secondary
  const isAuto = (inheritCandleColors || secondary) && !storageKey

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
            initialOpacity: value.opacity,
            initialLineStyle: value.lineStyle,
            initialThickness: value.thickness,
            showCustomColorsRow: true,
            showCustomPicker: true,
            showLineStyle: true,
            showOpacity: true,
            showThickness: true,
            thicknessSteps: 4,
            onPick: (payload) => {
              if (typeof payload?.hex !== 'string') return
              const nextValue = {
                hex: payload.hex,
                lineStyle: normalizeSettingsLineStyle(payload.lineStyle),
                opacity: typeof payload.opacity === 'number' && Number.isFinite(payload.opacity) ? payload.opacity : value.opacity,
                thickness: typeof payload.thickness === 'number' && Number.isFinite(payload.thickness)
                  ? Math.max(1, Math.min(Math.round(payload.thickness), 4))
                  : value.thickness,
              }
              setValue(nextValue)
              if (storageKey) writeSettingsSymbolStateValue(storageKey, nextValue)
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
            : { background: swatchColor, opacity: value.opacity }
        }
      />
      <span
        className="ff-settings-line-swatch__line"
        data-style={value.lineStyle}
        style={{
          borderTopColor: swatchColor,
          opacity: value.opacity,
          borderTopStyle: value.lineStyle === 'dotted' ? 'dotted' : value.lineStyle === 'dashed' ? 'dashed' : 'solid',
          borderTopWidth: `${value.thickness}px`,
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
