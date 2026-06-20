import type { SettingsSwatchValue } from '../../settings/SettingsSwatches'
import { DrawingTextPanel } from '../DrawingTextPanel'
import type { DrawingTextStyle } from '../drawingPersistence'
import type { DrawingTab, DrawingTool, DrawingToolKey } from '../drawingTools/drawingTypes'
import { DrawingToolActionControls, DrawingToolPersistenceControls, DrawingToolTabs } from '../DrawingToolControls'
import { StickerStylePanel, type StickerIconCategoryKey } from '../StickerStylePanel'

type EmojiStickerToolSettingsPanelProps = {
  activeIconCategory: StickerIconCategoryKey
  armedKey: DrawingToolKey | null
  onActiveTabChange: (tab: DrawingTab) => void
  onArm: () => void
  onDelete: () => void
  onPersistenceChange: (enabled: boolean) => void
  onRelease: () => void
  onStickerColorChange: (value: SettingsSwatchValue) => void
  onStickerIconCategoryChange: (category: StickerIconCategoryKey) => void
  onStickerSizeChange: (size: number) => void
  onStickerSymbolSelect: (symbol: string) => void
  onTextStyleChange: (value: DrawingTextStyle) => void
  onToggleLock: () => void
  selected: boolean
  selectedKey: DrawingToolKey
  selectedLocked: boolean
  selectedPersisted: boolean
  selectedStickerColor: string
  selectedStickerSize: number
  selectedStickerSymbol: string
  selectedTool: DrawingTool
  tabs: DrawingTab[]
  textStyle: DrawingTextStyle
  visibleTab: DrawingTab
}

const tabLabels: Record<DrawingTab, string> = {
  coords: '\u5750\u6807',
  style: '\u6837\u5f0f',
  text: '\u6587\u672c',
}

function DrawingToolPersistenceButtons({
  onPersistenceChange,
  selectedPersisted,
  selectedTool,
}: Pick<EmojiStickerToolSettingsPanelProps, 'onPersistenceChange' | 'selectedPersisted' | 'selectedTool'>) {
  return (
    <DrawingToolPersistenceControls
      onSave={() => onPersistenceChange(true)}
      onUnsave={() => onPersistenceChange(false)}
      persisted={selectedPersisted}
      toolLabel={selectedTool.label}
    />
  )
}

export function EmojiStickerToolSettingsPanel({
  activeIconCategory,
  armedKey,
  onActiveTabChange,
  onArm,
  onDelete,
  onPersistenceChange,
  onRelease,
  onStickerColorChange,
  onStickerIconCategoryChange,
  onStickerSizeChange,
  onStickerSymbolSelect,
  onTextStyleChange,
  onToggleLock,
  selected,
  selectedKey,
  selectedLocked,
  selectedPersisted,
  selectedStickerColor,
  selectedStickerSize,
  selectedStickerSymbol,
  selectedTool,
  tabs,
  textStyle,
  visibleTab,
}: EmojiStickerToolSettingsPanelProps) {
  return (
    <>
      <DrawingToolActionControls
        armed={armedKey === selectedKey}
        locked={selectedLocked}
        onArm={onArm}
        onDelete={onDelete}
        onRelease={onRelease}
        onToggleLock={onToggleLock}
        persistenceControls={<DrawingToolPersistenceButtons onPersistenceChange={onPersistenceChange} selectedPersisted={selectedPersisted} selectedTool={selectedTool} />}
        selected={selected}
        toolLabel={selectedTool.label}
      />
      <div className="ff-drawing-hline-settings-v1">
        <DrawingToolTabs
          activeKey={visibleTab}
          ariaLabel={`${selectedTool.label} settings`}
          onChange={(tab) => onActiveTabChange(tab as DrawingTab)}
          tabs={tabs.map((tab) => ({ key: tab, label: tabLabels[tab] }))}
          renderPanel={(tab) => tab === 'text'
            ? <DrawingTextPanel alignmentVisible={false} onTextStyleChange={onTextStyleChange} textStyle={textStyle} />
            : (
              <StickerStylePanel
                activeIconCategory={activeIconCategory}
                selectedColor={selectedStickerColor}
                selectedSymbol={selectedStickerSymbol}
                selectedSize={selectedStickerSize}
                onColorChange={onStickerColorChange}
                onSymbolSelect={onStickerSymbolSelect}
                onIconCategoryChange={onStickerIconCategoryChange}
                onSizeChange={onStickerSizeChange}
              />
            )}
        />
      </div>
    </>
  )
}
