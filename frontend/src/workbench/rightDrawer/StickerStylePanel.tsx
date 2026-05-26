import { SettingsColorSwatch } from '../settings/SettingsSwatches'
import type { SettingsSwatchValue } from '../settings/SettingsSwatches'

const stickerIconCategories = [
  { key: 'arrows', icon: '\u2197', label: '\u7bad\u5934', items: ['\u2191', '\u2193', '\u2190', '\u2192', '\u2197', '\u2198', '\u2196', '\u2199', '\u21d1', '\u21d3', '\u21d0', '\u21d2', '\u27f0', '\u27f1', '\u21ba', '\u21bb', '\u2b06', '\u2b07', '\u2b05', '\u27a1', '\u2b08', '\u2b0a', '\u2b09', '\u2b0b'] },
  { key: 'signals', icon: '\u25b2', label: '\u4ea4\u6613\u6807\u8bb0', items: ['\u25b2', '\u25bc', '\u25b3', '\u25bd', '\u25c6', '\u25c7', '\u25cf', '\u25cb', '\u25a0', '\u25a1', '\u25b6', '\u25c0', '\u2715', '\u2713', '\u002b', '\u2212'] },
  { key: 'shapes', icon: '\u25a3', label: '\u5f62\u72b6', items: ['\u25a0', '\u25a1', '\u25ad', '\u25af', '\u25b0', '\u25b1', '\u25c6', '\u25c7', '\u25cf', '\u25cb', '\u25ce', '\u25cc', '\u25b2', '\u25bc', '\u25c0', '\u25b6', '\u2605', '\u2606', '\u25c9', '\u25cd', '\u25e6', '\u25aa', '\u25ab', '\u25ac'] },
  { key: 'math', icon: '\u00b1', label: '\u6570\u5b66\u7b26\u53f7', items: ['\u00b1', '\u00d7', '\u00f7', '\u2248', '\u2260', '\u2264', '\u2265', '\u221e', '\u0394', '\u03a3', '\u03c0', '\u03bc', '\u03b1', '\u03b2', '\u03b3', '\u03bb', '\u03c3', '\u03c9', '\u2192', '\u21d2', '\u2227', '\u2228', '\u2229', '\u222a'] },
] as const

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
