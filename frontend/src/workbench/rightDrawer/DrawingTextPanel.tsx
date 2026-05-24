import { useEffect } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { SettingsColorSwatch } from '../settings/SettingsSwatches'
import type { DrawingTextStyle } from './drawingPersistence'
import { normalizeDrawingTextStyle } from './drawingPersistence'

const fontSizeOptions = [
  { label: '10', value: '10' },
  { label: '12', value: '12' },
  { label: '14', value: '14' },
  { label: '16', value: '16' },
  { label: '18', value: '18' },
  { label: '20', value: '20' },
  { label: '24', value: '24' },
]

const verticalAlignOptions = [
  { label: '\u9876\u90e8', value: 'top' },
  { label: '\u4e2d\u95f4', value: 'middle' },
  { label: '\u5e95\u90e8', value: 'bottom' },
]

const horizontalAlignOptions = [
  { label: '\u5de6', value: 'left' },
  { label: '\u4e2d', value: 'center' },
  { label: '\u53f3', value: 'right' },
]

export function DrawingTextPanel({
  alignmentVisible = true,
  onTextStyleChange,
  textStyle,
}: {
  alignmentVisible?: boolean
  onTextStyleChange: (value: DrawingTextStyle) => void
  textStyle: DrawingTextStyle
}) {
  const displayTextStyle = normalizeDrawingTextStyle(textStyle)

  useEffect(() => {
    if (displayTextStyle.body === textStyle.body) return
    onTextStyleChange(displayTextStyle)
  }, [displayTextStyle, onTextStyleChange, textStyle.body])

  const update = (patch: Partial<DrawingTextStyle>) => {
    onTextStyleChange(normalizeDrawingTextStyle({ ...displayTextStyle, ...patch }))
  }

  return (
    <div className="ff-drawing-hline-text-tab-v1">
      <div className="ff-drawing-hline-text-tab-v1__toolbar">
        <SettingsColorSwatch
          color={displayTextStyle.textColor}
          onChange={(value) => update({ textColor: value.hex })}
          value={{ hex: displayTextStyle.textColor, opacity: 1 }}
        />
        <OpenableSelect
          ariaLabel="Font size"
          className="ff-drawing-hline-text-tab-v1__font-size"
          onChange={(value) => update({ fontSize: Number(value) })}
          options={fontSizeOptions}
          value={String(displayTextStyle.fontSize)}
        />
        <button
          aria-pressed={displayTextStyle.bold}
          className="ff-drawing-hline-text-tab-v1__toggle"
          data-active={displayTextStyle.bold ? 'true' : undefined}
          onClick={() => update({ bold: !displayTextStyle.bold })}
          type="button"
        >
          B
        </button>
        <button
          aria-pressed={displayTextStyle.italic}
          className="ff-drawing-hline-text-tab-v1__toggle"
          data-active={displayTextStyle.italic ? 'true' : undefined}
          onClick={() => update({ italic: !displayTextStyle.italic })}
          type="button"
        >
          I
        </button>
      </div>
      <textarea
        className="ff-drawing-hline-text-tab-v1__textarea"
        onChange={(event) => update({ body: event.target.value })}
        placeholder={'\u6dfb\u52a0\u6587\u5b57'}
        rows={4}
        spellCheck={false}
        value={displayTextStyle.body}
      />
      {alignmentVisible ? <div className="ff-drawing-hline-text-tab-v1__align-row">
        <span className="ff-drawing-hline-text-tab-v1__align-label">{'\u5bf9\u9f50'}</span>
        <OpenableSelect
          ariaLabel="\u5782\u76f4\u5bf9\u9f50"
          className="ff-drawing-hline-text-tab-v1__align-select"
          onChange={(value) => update({ alignV: value as DrawingTextStyle['alignV'] })}
          options={verticalAlignOptions}
          value={displayTextStyle.alignV}
        />
        <OpenableSelect
          ariaLabel="\u6c34\u5e73\u5bf9\u9f50"
          className="ff-drawing-hline-text-tab-v1__align-select"
          onChange={(value) => update({ alignH: value as DrawingTextStyle['alignH'] })}
          options={horizontalAlignOptions}
          value={displayTextStyle.alignH}
        />
      </div> : null}
    </div>
  )
}
