import { SettingsColorSwatch } from '../settings/SettingsSwatches'
import type { SettingsSwatchValue } from '../settings/SettingsSwatches'
import { stickerIconCategories } from './stickerSymbols'

export type StickerIconCategoryKey = (typeof stickerIconCategories)[number]['key']

export function StickerStylePanel({
  activeIconCategory,
  onColorChange,
  onIconCategoryChange,
  onSizeChange,
  onSymbolSelect,
  selectedColor,
  selectedSize,
  selectedSymbol,
}: {
  activeIconCategory: StickerIconCategoryKey
  onColorChange: (value: SettingsSwatchValue) => void
  onIconCategoryChange: (key: StickerIconCategoryKey) => void
  onSizeChange: (value: number) => void
  onSymbolSelect: (symbol: string) => void
  selectedColor: string
  selectedSize: number
  selectedSymbol: string
}) {
  const activeIcon = stickerIconCategories.find((category) => category.key === activeIconCategory) ?? stickerIconCategories[0]

  return (
    <div className="ff-drawing-emoji-sticker-v1" data-mode="icon">
      <div className="ff-drawing-emoji-sticker-v1__category-tabs" role="tablist" aria-label="Sticker categories">
        {stickerIconCategories.map((category) => (
          <button
            aria-label={category.label}
            aria-selected={activeIconCategory === category.key}
            className="ff-drawing-emoji-sticker-v1__category-tab"
            data-active={activeIconCategory === category.key ? 'true' : 'false'}
            key={category.key}
            onClick={() => onIconCategoryChange(category.key)}
            role="tab"
            title={category.label}
            type="button"
          >
            {category.icon}
          </button>
        ))}
      </div>
      <div className="ff-drawing-emoji-sticker-v1__selected" aria-live="polite">
        <span className="ff-drawing-emoji-sticker-v1__preview">{selectedSymbol}</span>
      </div>
      <div className="ff-drawing-emoji-sticker-v1__grid" role="listbox" aria-label={activeIcon.label}>
        {activeIcon.items.map((symbol) => (
          <button
            aria-selected={selectedSymbol === symbol}
            className="ff-drawing-emoji-sticker-v1__item"
            data-active={selectedSymbol === symbol ? 'true' : 'false'}
            key={symbol}
            onClick={() => onSymbolSelect(symbol)}
            role="option"
            type="button"
          >
            {symbol}
          </button>
        ))}
      </div>
      <div className="ff-drawing-emoji-sticker-v1__style-row">
        <SettingsColorSwatch
          color={selectedColor}
          value={{ hex: selectedColor, opacity: 1 }}
          onChange={onColorChange}
        />
        <input
          aria-label="Sticker size"
          className="ff-drawing-emoji-sticker-v1__size-input"
          max={96}
          min={12}
          onChange={(event) => onSizeChange(Number(event.target.value))}
          type="number"
          value={selectedSize}
        />
      </div>
    </div>
  )
}
