/* eslint-disable react-refresh/only-export-components, react-hooks/refs, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readJson, writeJson } from '../persistence/jsonStorage'
import { SettingsColorSwatch, SettingsLineSwatch } from '../settings/SettingsSwatches'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { createDefaultDrawingLineStyle } from './drawingPersistence'
import './FibRetracementStylePanel.css'

const fibLevelDefaults = [
  { color: '#787b86', enabled: true, opacity: 1, value: '0' },
  { color: '#f23645', enabled: true, opacity: 1, value: '0.236' },
  { color: '#81c784', enabled: true, opacity: 1, value: '0.382' },
  { color: '#4caf50', enabled: true, opacity: 1, value: '0.5' },
  { color: '#009688', enabled: true, opacity: 1, value: '0.618' },
  { color: '#64b5f6', enabled: true, opacity: 1, value: '0.786' },
  { color: '#787b86', enabled: true, opacity: 1, value: '1' },
  { color: '#90caf9', enabled: false, opacity: 1, value: '1.618' },
]

export type FibLevelState = typeof fibLevelDefaults[number]

export function sameFibLevels(a: FibLevelState[], b: FibLevelState[]) {
  return a.length === b.length && a.every((level, index) => {
    const other = b[index]
    return other
      && level.color === other.color
      && level.enabled === other.enabled
      && Math.abs((level.opacity ?? 1) - (other.opacity ?? 1)) < 0.001
      && level.value === other.value
  })
}

export function sameLineSwatch(a: SettingsLineSwatchValue, b: SettingsLineSwatchValue) {
  return a.hex === b.hex
    && a.lineStyle === b.lineStyle
    && Math.abs(a.opacity - b.opacity) < 0.001
    && a.thickness === b.thickness
}

export function sameLineSwatchList(a: SettingsLineSwatchValue[], b: SettingsLineSwatchValue[]) {
  return a.length === b.length && a.every((item, index) => sameLineSwatch(item, b[index]))
}

function sameFibStylePayload(
  a: { backgroundEnabled: boolean; backgroundOpacity: number; horizontalLineStyle: SettingsLineSwatchValue; labelAlign: string; labelFontSize: string; labelVAlign: string; levelDisplay: string; levelVisible: boolean; levels: FibLevelState[]; priceVisible: boolean; quarterLineStyles: SettingsLineSwatchValue[]; quarterSplitVisible: boolean; reverse: boolean } | null,
  b: { backgroundEnabled: boolean; backgroundOpacity: number; horizontalLineStyle: SettingsLineSwatchValue; labelAlign: string; labelFontSize: string; labelVAlign: string; levelDisplay: string; levelVisible: boolean; levels: FibLevelState[]; priceVisible: boolean; quarterLineStyles: SettingsLineSwatchValue[]; quarterSplitVisible: boolean; reverse: boolean },
) {
  return a != null
    && a.backgroundEnabled === b.backgroundEnabled
    && Math.abs(a.backgroundOpacity - b.backgroundOpacity) < 0.001
    && a.labelAlign === b.labelAlign
    && a.labelFontSize === b.labelFontSize
    && a.labelVAlign === b.labelVAlign
    && a.levelDisplay === b.levelDisplay
    && a.levelVisible === b.levelVisible
    && a.priceVisible === b.priceVisible
    && a.quarterSplitVisible === b.quarterSplitVisible
    && sameLineSwatchList(a.quarterLineStyles, b.quarterLineStyles)
    && a.reverse === b.reverse
    && sameLineSwatch(a.horizontalLineStyle, b.horizontalLineStyle)
    && sameFibLevels(a.levels, b.levels)
}

type FibRetracementStyleState = {
  background: { hex: string; opacity: number }
  backgroundEnabled: boolean
  extendLeft: boolean
  extendRight: boolean
  fontSize: string
  horizontalLineStyle: 'solid' | 'dashed' | 'dotted'
  horizontalLineThickness: number
  labelAlign: string
  labelVAlign: string
  levelDisplay: string
  levelVisible: boolean
  levels: FibLevelState[]
  priceVisible: boolean
  quarterLineStyles: SettingsLineSwatchValue[]
  reverse: boolean
  textAlign: string
  textVAlign: string
  textVisible: boolean
  trendLineStyle: SettingsLineSwatchValue
  trendLineVisible: boolean
}

const fibRetracementStyleStorageKey = 'fractalframe.drawingsDrawer.fibRetracementStyle'
const defaultFibTrendLineStyle: SettingsLineSwatchValue = {
  hex: '#b6bac4',
  lineStyle: 'dashed',
  opacity: 1,
  thickness: 1,
}

const defaultFibQuarterLineStyle: SettingsLineSwatchValue = {
  hex: '#787b86',
  lineStyle: 'solid',
  opacity: 1,
  thickness: 1,
}

export function normalizeFibQuarterLineStyles(value: unknown): SettingsLineSwatchValue[] {
  const source = Array.isArray(value) ? value : []
  return [0, 1, 2].map((index) => ({
    ...defaultFibQuarterLineStyle,
    ...createDefaultDrawingLineStyle(source[index]?.hex ?? defaultFibQuarterLineStyle.hex),
    hex: typeof source[index]?.hex === 'string' && source[index].hex.trim() ? source[index].hex : defaultFibQuarterLineStyle.hex,
    lineStyle: source[index]?.lineStyle === 'dashed' || source[index]?.lineStyle === 'dotted' ? source[index].lineStyle : defaultFibQuarterLineStyle.lineStyle,
    opacity: typeof source[index]?.opacity === 'number' && Number.isFinite(source[index].opacity) ? Math.max(0, Math.min(source[index].opacity, 1)) : defaultFibQuarterLineStyle.opacity,
    thickness: typeof source[index]?.thickness === 'number' && Number.isFinite(source[index].thickness) ? Math.max(1, Math.min(Math.round(source[index].thickness), 4)) : defaultFibQuarterLineStyle.thickness,
  }))
}

function normalizeFibRetracementStyleState(value: Partial<FibRetracementStyleState> | null | undefined): FibRetracementStyleState {
  const lineStyle = value?.trendLineStyle
  const backgroundOpacity = Number(value?.background?.opacity)
  const horizontalLineThickness = Number(value?.horizontalLineThickness)
  return {
    background: {
      hex: typeof value?.background?.hex === 'string' && value.background.hex.trim() ? value.background.hex : '#2962ff',
      opacity: Number.isFinite(backgroundOpacity) ? Math.max(0, Math.min(backgroundOpacity, 1)) : 0.25,
    },
    backgroundEnabled: value?.backgroundEnabled !== false,
    extendLeft: value?.extendLeft === true,
    extendRight: value?.extendRight === true,
    fontSize: ['10', '12', '14', '16', '18', '20'].includes(String(value?.fontSize)) ? String(value?.fontSize) : '12',
    horizontalLineStyle: value?.horizontalLineStyle === 'dashed' || value?.horizontalLineStyle === 'dotted' ? value.horizontalLineStyle : 'solid',
    horizontalLineThickness: Number.isFinite(horizontalLineThickness) ? Math.max(1, Math.min(Math.round(horizontalLineThickness), 4)) : 1,
    labelAlign: typeof value?.labelAlign === 'string' ? value.labelAlign : 'center',
    labelVAlign: typeof value?.labelVAlign === 'string' ? value.labelVAlign : 'top',
    levelDisplay: value?.levelDisplay === 'percent' ? 'percent' : 'value',
    levelVisible: value?.levelVisible !== false,
    levels: Array.isArray(value?.levels) && value.levels.length > 0
      ? value.levels.slice(0, fibLevelDefaults.length).map((level, index) => ({
          color: typeof level.color === 'string' && level.color.trim() ? level.color : fibLevelDefaults[index]?.color ?? '#787b86',
          enabled: level.enabled !== false,
          opacity: typeof level.opacity === 'number' && Number.isFinite(level.opacity) ? Math.max(0, Math.min(level.opacity, 1)) : fibLevelDefaults[index]?.opacity ?? 1,
          value: typeof level.value === 'string' ? level.value : fibLevelDefaults[index]?.value ?? '0',
        }))
      : fibLevelDefaults,
    priceVisible: value?.priceVisible !== false,
    quarterLineStyles: normalizeFibQuarterLineStyles(value?.quarterLineStyles),
    reverse: value?.reverse === true,
    textAlign: typeof value?.textAlign === 'string' ? value.textAlign : 'center',
    textVAlign: typeof value?.textVAlign === 'string' ? value.textVAlign : 'middle',
    textVisible: value?.textVisible !== false,
    trendLineStyle: {
      hex: typeof lineStyle?.hex === 'string' && lineStyle.hex.trim() ? lineStyle.hex : defaultFibTrendLineStyle.hex,
      lineStyle: lineStyle?.lineStyle === 'solid' || lineStyle?.lineStyle === 'dotted' ? lineStyle.lineStyle : defaultFibTrendLineStyle.lineStyle,
      opacity: typeof lineStyle?.opacity === 'number' && Number.isFinite(lineStyle.opacity) ? Math.max(0, Math.min(lineStyle.opacity, 1)) : defaultFibTrendLineStyle.opacity,
      thickness: typeof lineStyle?.thickness === 'number' && Number.isFinite(lineStyle.thickness) ? Math.max(1, Math.min(Math.round(lineStyle.thickness), 4)) : defaultFibTrendLineStyle.thickness,
    },
    trendLineVisible: value?.trendLineVisible === true,
  }
}

export function readFibRetracementStyleState() {
  return normalizeFibRetracementStyleState(readJson<Partial<FibRetracementStyleState> | null>(fibRetracementStyleStorageKey, null))
}

function writeFibRetracementStyleState(value: FibRetracementStyleState) {
  writeJson(fibRetracementStyleStorageKey, normalizeFibRetracementStyleState(value))
}

export function FibRetracementStylePanel({
  backgroundOpacityValue,
  backgroundVisibleValue,
  reverseValue,
  horizontalLineStyleValue,
  labelAlignValue,
  labelFontSizeValue,
  labelVAlignValue,
  levelDisplayValue,
  levelVisibleValue,
  levelsValue,
  onFibRetracementStyleChange,
  priceVisibleValue,
  quarterLineStylesValue,
  quarterSplitVisibleValue,
  onTrendLineChange,
  trendLineStyle,
  trendLineVisible,
}: {
  backgroundOpacityValue: number
  backgroundVisibleValue: boolean
  reverseValue: boolean
  horizontalLineStyleValue: SettingsLineSwatchValue
  labelAlignValue: string
  labelFontSizeValue: string
  labelVAlignValue: string
  levelDisplayValue: string
  levelVisibleValue: boolean
  levelsValue: FibLevelState[]
  onFibRetracementStyleChange: (levels: FibLevelState[], horizontalLineStyle: SettingsLineSwatchValue, backgroundVisible: boolean, backgroundOpacity: number, reverse: boolean, priceVisible: boolean, labelAlign: string, labelVAlign: string, labelFontSize: string, levelVisible: boolean, levelDisplay: string, quarterSplitVisible: boolean, quarterLineStyles: SettingsLineSwatchValue[]) => void
  priceVisibleValue: boolean
  quarterLineStylesValue: SettingsLineSwatchValue[]
  quarterSplitVisibleValue: boolean
  onTrendLineChange: (visible: boolean, style?: SettingsLineSwatchValue) => void
  trendLineStyle: SettingsLineSwatchValue
  trendLineVisible: boolean
}) {
  const initialStyleRef = useRef<FibRetracementStyleState | null>(null)
  if (!initialStyleRef.current) initialStyleRef.current = readFibRetracementStyleState()
  const initialStyle = initialStyleRef.current
  const [levels, setLevels] = useState(levelsValue.length > 0 ? levelsValue : initialStyle.levels)
  const [backgroundEnabled, setBackgroundEnabled] = useState(backgroundVisibleValue)
  const [background, setBackground] = useState({ ...initialStyle.background, opacity: backgroundOpacityValue })
  const [reverse, setReverse] = useState(reverseValue)
  const [priceVisible, setPriceVisible] = useState(priceVisibleValue)
  const [levelVisible, setLevelVisible] = useState(levelVisibleValue)
  const [textVisible, setTextVisible] = useState(quarterSplitVisibleValue)
  const [horizontalLineThickness, setHorizontalLineThickness] = useState(horizontalLineStyleValue.thickness || initialStyle.horizontalLineThickness)
  const [horizontalLineThicknessOpen, setHorizontalLineThicknessOpen] = useState(false)
  const [horizontalLineStyle, setHorizontalLineStyle] = useState<'solid' | 'dashed' | 'dotted'>(horizontalLineStyleValue.lineStyle || initialStyle.horizontalLineStyle)
  const [horizontalLineStyleOpen, setHorizontalLineStyleOpen] = useState(false)
  const [extendLeft, setExtendLeft] = useState(initialStyle.extendLeft)
  const [extendRight, setExtendRight] = useState(initialStyle.extendRight)
  const [extendOpen, setExtendOpen] = useState(false)
  const horizontalLineThicknessRef = useRef<HTMLDivElement | null>(null)
  const horizontalLineStyleRef = useRef<HTMLDivElement | null>(null)
  const extendRef = useRef<HTMLDivElement | null>(null)
  const [levelDisplay, setLevelDisplay] = useState(levelDisplayValue)
  const [labelAlign, setLabelAlign] = useState(labelAlignValue)
  const [labelVAlign, setLabelVAlign] = useState(labelVAlignValue)
  const [textAlign] = useState(initialStyle.textAlign)
  const [textVAlign] = useState(initialStyle.textVAlign)
  const [fontSize, setFontSize] = useState(labelFontSizeValue)
  const [quarterLineStyles, setQuarterLineStyles] = useState<SettingsLineSwatchValue[]>(quarterLineStylesValue.length === 3 ? quarterLineStylesValue : initialStyle.quarterLineStyles)
  const lastPublishedFibStyleRef = useRef<{
    backgroundEnabled: boolean
    backgroundOpacity: number
    horizontalLineStyle: SettingsLineSwatchValue
    labelAlign: string
    labelFontSize: string
    labelVAlign: string
    levelDisplay: string
    levelVisible: boolean
    levels: FibLevelState[]
    priceVisible: boolean
    quarterLineStyles: SettingsLineSwatchValue[]
    quarterSplitVisible: boolean
    reverse: boolean
  } | null>(null)

  const updateLevel = (index: number, patch: Partial<typeof fibLevelDefaults[number]>) => {
    setLevels((current) => current.map((level, levelIndex) => levelIndex === index ? { ...level, ...patch } : level))
  }

  const updateQuarterLineStyle = (index: number, value: SettingsLineSwatchValue) => {
    setQuarterLineStyles((current) => current.map((style, styleIndex) => styleIndex === index ? value : style))
  }

  useEffect(() => {
    if (levelsValue.length > 0) {
      setLevels((current) => sameFibLevels(current, levelsValue) ? current : levelsValue)
    }
    setHorizontalLineThickness((current) => current === (horizontalLineStyleValue.thickness || 1) ? current : horizontalLineStyleValue.thickness || 1)
    setHorizontalLineStyle((current) => current === (horizontalLineStyleValue.lineStyle || 'solid') ? current : horizontalLineStyleValue.lineStyle || 'solid')
    setBackgroundEnabled((current) => current === backgroundVisibleValue ? current : backgroundVisibleValue)
    setBackground((current) => Math.abs(current.opacity - backgroundOpacityValue) < 0.001 ? current : { ...current, opacity: backgroundOpacityValue })
    setReverse((current) => current === reverseValue ? current : reverseValue)
    setPriceVisible((current) => current === priceVisibleValue ? current : priceVisibleValue)
    setLabelAlign((current) => current === labelAlignValue ? current : labelAlignValue)
    setLabelVAlign((current) => current === labelVAlignValue ? current : labelVAlignValue)
    setFontSize((current) => current === labelFontSizeValue ? current : labelFontSizeValue)
    setLevelVisible((current) => current === levelVisibleValue ? current : levelVisibleValue)
    setLevelDisplay((current) => current === levelDisplayValue ? current : levelDisplayValue)
    setTextVisible((current) => current === quarterSplitVisibleValue ? current : quarterSplitVisibleValue)
    const nextQuarterLineStyles = normalizeFibQuarterLineStyles(quarterLineStylesValue)
    setQuarterLineStyles((current) => sameLineSwatchList(current, nextQuarterLineStyles) ? current : nextQuarterLineStyles)
  }, [backgroundOpacityValue, backgroundVisibleValue, horizontalLineStyleValue, labelAlignValue, labelFontSizeValue, labelVAlignValue, levelDisplayValue, levelVisibleValue, levelsValue, priceVisibleValue, quarterLineStylesValue, quarterSplitVisibleValue, reverseValue])

  useEffect(() => {
    const nextHorizontalLineStyle: SettingsLineSwatchValue = {
      hex: '#787b86',
      lineStyle: horizontalLineStyle,
      opacity: 1,
      thickness: horizontalLineThickness,
    }
    writeFibRetracementStyleState({
      background,
      backgroundEnabled,
      extendLeft,
      extendRight,
      fontSize,
      horizontalLineStyle,
      horizontalLineThickness,
      labelAlign,
      labelVAlign,
      levelDisplay,
      levelVisible,
      levels,
      priceVisible,
      quarterLineStyles,
      reverse,
      textAlign,
      textVAlign,
      textVisible,
      trendLineStyle,
      trendLineVisible,
    })
    const nextPayload = {
      backgroundEnabled,
      backgroundOpacity: background.opacity,
      horizontalLineStyle: nextHorizontalLineStyle,
      labelAlign,
      labelFontSize: fontSize,
      labelVAlign,
      levelDisplay,
      levelVisible,
      levels,
      priceVisible,
      quarterLineStyles,
      quarterSplitVisible: textVisible,
      reverse,
    }
    if (!sameFibStylePayload(lastPublishedFibStyleRef.current, nextPayload)) {
      lastPublishedFibStyleRef.current = nextPayload
      onFibRetracementStyleChange(levels, nextHorizontalLineStyle, backgroundEnabled, background.opacity, reverse, priceVisible, labelAlign, labelVAlign, fontSize, levelVisible, levelDisplay, textVisible, quarterLineStyles)
    }
  }, [background, backgroundEnabled, extendLeft, extendRight, fontSize, horizontalLineStyle, horizontalLineThickness, labelAlign, labelVAlign, levelDisplay, levelVisible, levels, onFibRetracementStyleChange, priceVisible, quarterLineStyles, reverse, textAlign, textVAlign, textVisible, trendLineStyle, trendLineVisible])

  useEffect(() => {
    if (!horizontalLineThicknessOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (horizontalLineThicknessRef.current?.contains(event.target as Node)) return
      setHorizontalLineThicknessOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHorizontalLineThicknessOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [horizontalLineThicknessOpen])

  useEffect(() => {
    if (!horizontalLineStyleOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (horizontalLineStyleRef.current?.contains(event.target as Node)) return
      setHorizontalLineStyleOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHorizontalLineStyleOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [horizontalLineStyleOpen])

  useEffect(() => {
    if (!extendOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (extendRef.current?.contains(event.target as Node)) return
      setExtendOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExtendOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [extendOpen])

  const extendLabel = extendLeft && extendRight
    ? '双向'
    : extendLeft
      ? '向左'
      : extendRight
        ? '向右'
        : '不要扩大'

  return (
    <div className="ff-drawing-fib-style-v1">
      <div className="ff-drawing-fib-top-row-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={trendLineVisible} onChange={(event) => onTrendLineChange(event.target.checked, trendLineStyle)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">趋势线</span>
        <SettingsLineSwatch
          color={trendLineStyle.hex}
          lineStyle={trendLineStyle.lineStyle}
          onChange={(value) => onTrendLineChange(trendLineVisible, value)}
          thickness={trendLineStyle.thickness}
          value={trendLineStyle}
        />
      </div>

      <div className="ff-drawing-fib-top-row-v1 ff-drawing-fib-top-row-v1--horizontal">
        <span className="ff-drawing-tline-tv-label-v1">水平线</span>
        <div className="ff-drawing-fib-horizontal-controls-v1">
          <div className="ff-drawing-fib-line-width-picker-v1" ref={horizontalLineThicknessRef}>
            <button
              aria-expanded={horizontalLineThicknessOpen}
              aria-label="水平线粗细"
              className="ff-drawing-fib-line-preview-v1"
              data-open={horizontalLineThicknessOpen ? 'true' : undefined}
              onClick={() => setHorizontalLineThicknessOpen((current) => !current)}
              style={{ '--ff-drawing-fib-line-size': `${horizontalLineThickness}px` } as CSSProperties}
              type="button"
            >
              <span />
            </button>
            {horizontalLineThicknessOpen ? (
              <div className="ff-drawing-fib-line-width-menu-v1">
                {[1, 2, 3, 4].map((size) => (
                  <button
                    className="ff-drawing-fib-line-width-option-v1"
                    data-active={horizontalLineThickness === size ? 'true' : undefined}
                    key={size}
                    onClick={() => {
                      setHorizontalLineThickness(size)
                      setHorizontalLineThicknessOpen(false)
                    }}
                    style={{ '--ff-drawing-fib-line-size': `${size}px` } as CSSProperties}
                    type="button"
                  >
                    <span />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="ff-drawing-fib-line-style-picker-v1" ref={horizontalLineStyleRef}>
            <button
              aria-expanded={horizontalLineStyleOpen}
              aria-label="水平线线型"
              className="ff-drawing-fib-line-end-v1"
              data-open={horizontalLineStyleOpen ? 'true' : undefined}
              data-line-style={horizontalLineStyle}
              onClick={() => setHorizontalLineStyleOpen((current) => !current)}
              type="button"
            >
              <span />
            </button>
            {horizontalLineStyleOpen ? (
              <div className="ff-drawing-fib-line-style-menu-v1">
                {[
                  { label: '线形图', value: 'solid' as const },
                  { label: '短虚线', value: 'dashed' as const },
                  { label: '点虚线', value: 'dotted' as const },
                ].map((option) => (
                  <button
                    className="ff-drawing-fib-line-style-option-v1"
                    data-active={horizontalLineStyle === option.value ? 'true' : undefined}
                    data-line-style={option.value}
                    key={option.value}
                    onClick={() => {
                      setHorizontalLineStyle(option.value)
                      setHorizontalLineStyleOpen(false)
                    }}
                    type="button"
                  >
                    <span className="ff-drawing-fib-line-style-option-v1__line" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ff-drawing-fib-extend-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">延伸</span>
        <div className="ff-drawing-fib-extend-picker-v1" data-open={extendOpen ? 'true' : undefined} ref={extendRef}>
          <button
            aria-expanded={extendOpen}
            aria-label="延伸"
            className="ff-drawing-fib-extend-button-v1 ff-openable-control"
            onClick={() => setExtendOpen((current) => !current)}
            type="button"
          >
            <span>{extendLabel}</span>
            <span aria-hidden="true" className="ff-drawing-fib-extend-chevron-v1">{'\u2304'}</span>
          </button>
          {extendOpen ? (
            <div className="ff-drawing-fib-extend-menu-v1">
              <button className="ff-drawing-fib-extend-option-v1" onClick={() => setExtendLeft((current) => !current)} type="button">
                <span className="ff-drawing-fib-extend-box-v1" data-checked={extendLeft ? 'true' : undefined} />
                <span>左侧延长线</span>
              </button>
              <button className="ff-drawing-fib-extend-option-v1" onClick={() => setExtendRight((current) => !current)} type="button">
                <span className="ff-drawing-fib-extend-box-v1" data-checked={extendRight ? 'true' : undefined} />
                <span>右侧延长线</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ff-drawing-fib-levels-v1">
        {levels.map((level, index) => (
          <div className="ff-drawing-fib-level-row-v1" key={index}>
            <label className="ff-drawing-tline-tv-check-row-v1">
              <input checked={level.enabled} onChange={(event) => updateLevel(index, { enabled: event.target.checked })} type="checkbox" />
              <span className="ff-drawing-tline-tv-check-box-v1" />
            </label>
            <input
              className="ff-drawing-fib-level-input-v1"
              onChange={(event) => updateLevel(index, { value: event.target.value })}
              type="number"
              value={level.value}
            />
            <SettingsColorSwatch
              checkerboard
              color={level.color}
              onChange={(value) => updateLevel(index, { color: value.hex, opacity: value.opacity })}
              value={{ hex: level.color, opacity: level.opacity }}
            />
          </div>
        ))}
      </div>

      <div className="ff-drawing-fib-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={backgroundEnabled} onChange={(event) => setBackgroundEnabled(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">背景</span>
        <div className="ff-drawing-fib-opacity-control-v1">
          <input
            aria-label="背景透明度"
            max={100}
            min={0}
            onChange={(event) => setBackground((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))}
            type="range"
            value={Math.round(background.opacity * 100)}
          />
          <span>{`${Math.round(background.opacity * 100)}%`}</span>
        </div>
      </div>

      <div className="ff-drawing-fib-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={reverse} onChange={(event) => setReverse(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">反手</span>
      </div>

      <div className="ff-drawing-fib-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={priceVisible} onChange={(event) => setPriceVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">价格</span>
      </div>

      <div className="ff-drawing-fib-select-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={levelVisible} onChange={(event) => setLevelVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">水平位</span>
        <OpenableSelect ariaLabel="水平位" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setLevelDisplay} options={[{ label: '数值', value: 'value' }, { label: '百分比', value: 'percent' }]} value={levelDisplay} />
      </div>

      <div className="ff-drawing-fib-select-line-v1 ff-drawing-fib-select-line-v1--plain-label">
        <span className="ff-drawing-fib-empty-check-v1" />
        <span className="ff-drawing-tline-tv-label-v1">标签</span>
        <OpenableSelect ariaLabel="标签位置" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setLabelAlign} options={[{ label: '左侧', value: 'left' }, { label: '中心', value: 'center' }, { label: '右侧', value: 'right' }]} value={labelAlign} />
        <OpenableSelect ariaLabel="标签垂直位置" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setLabelVAlign} options={[{ label: '顶部', value: 'top' }, { label: '中间', value: 'middle' }, { label: '底部', value: 'bottom' }]} value={labelVAlign} />
      </div>

      <div className="ff-drawing-fib-select-line-v1 ff-drawing-fib-select-line-v1--split-label">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={textVisible} onChange={(event) => setTextVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">0.236 分割</span>
      </div>

      {quarterLineStyles.map((style, index) => (
        <div className="ff-drawing-fib-quarter-row-v1" key={index}>
          <span className="ff-drawing-tline-tv-label-v1">{`${index + 1}/4`}</span>
          <SettingsLineSwatch
            color={style.hex}
            lineStyle={style.lineStyle}
            onChange={(value) => updateQuarterLineStyle(index, value)}
            thickness={style.thickness}
            value={style}
          />
        </div>
      ))}
    </div>
  )
}
