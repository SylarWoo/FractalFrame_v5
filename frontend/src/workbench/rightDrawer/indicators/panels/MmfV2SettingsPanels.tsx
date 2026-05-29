import type { MmfIndicatorSettings } from '../../indicatorPersistence'
import type { SymbolSelectSize } from '../../../controls/SymbolSelect'
import { mmfCrossSymbolOptions, mmfTradeArrowSymbolOptions } from '../../stickerSymbols'
import { CheckControl, NumberBox, updateMmfSettings } from './indicatorPanelShared'
import { MmfMarkerStyleRow } from './MmfSettingsControls'

function resolveCompactSymbolSize(): SymbolSelectSize {
  return 'compact'
}

export function MmfV2InputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
}) {
  const patch = (next: Partial<MmfIndicatorSettings>) => onSettingsChange(updateMmfSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mmf-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section ff-indicators-mmf-panel-v1__scroll-section">
        <MmfV2StochKAdvanceBlock
          checked={settings.showHigh}
          confirmLookaheadValue={settings.highConfirmLookaheadBars}
          lookbackLabel={'\u9ad8\u70b9\u8303\u56f4'}
          lookbackValue={settings.highAnchorLookbackBars}
          label={'\u9ad8\u70b9'}
          onCrossCheckedChange={(showDeadCross) => patch({ showDeadCross })}
          onCheckedChange={(showHigh) => patch({ showHigh })}
          onConfirmLookaheadChange={(highConfirmLookaheadBars) => patch({ highConfirmLookaheadBars })}
          onLookbackChange={(highAnchorLookbackBars) => patch({ highAnchorLookbackBars })}
          onTradeCheckedChange={(showHighConfirmPoint) => patch({ showHighConfirmPoint })}
          onValueChange={(highStochKAdvance) => patch({ highStochKAdvance })}
          crossChecked={settings.showDeadCross}
          crossLabel={'\u663e\u793a\u6b7b\u53c9'}
          tradeChecked={settings.showHighConfirmPoint}
          tradeLabel={'\u9ad8\u70b9\u786e\u8ba4\u70b9'}
          value={settings.highStochKAdvance}
        />
        <MmfV2StochKAdvanceBlock
          checked={settings.showLow}
          confirmLookaheadValue={settings.lowConfirmLookaheadBars}
          lookbackLabel={'\u4f4e\u70b9\u8303\u56f4'}
          lookbackValue={settings.lowAnchorLookbackBars}
          label={'\u4f4e\u70b9'}
          onCrossCheckedChange={(showGoldenCross) => patch({ showGoldenCross })}
          onCheckedChange={(showLow) => patch({ showLow })}
          onConfirmLookaheadChange={(lowConfirmLookaheadBars) => patch({ lowConfirmLookaheadBars })}
          onLookbackChange={(lowAnchorLookbackBars) => patch({ lowAnchorLookbackBars })}
          onTradeCheckedChange={(showLowConfirmPoint) => patch({ showLowConfirmPoint })}
          onValueChange={(lowStochKAdvance) => patch({ lowStochKAdvance })}
          crossChecked={settings.showGoldenCross}
          crossLabel={'\u663e\u793a\u91d1\u53c9'}
          tradeChecked={settings.showLowConfirmPoint}
          tradeLabel={'\u4f4e\u70b9\u786e\u8ba4\u70b9'}
          value={settings.lowStochKAdvance}
        />
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showSupportLevel}
              label={'\u652f\u6491\u4f4d'}
              onChange={(showSupportLevel) => patch({ showSupportLevel })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showResistanceLevel}
              label={'\u963b\u529b\u4f4d'}
              onChange={(showResistanceLevel) => patch({ showResistanceLevel })}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function MmfV2StochKAdvanceBlock({
  checked,
  confirmLookaheadValue,
  crossChecked,
  crossLabel,
  label,
  lookbackLabel,
  lookbackValue,
  onCrossCheckedChange,
  onCheckedChange,
  onConfirmLookaheadChange,
  onLookbackChange,
  onTradeCheckedChange,
  onValueChange,
  tradeChecked,
  tradeLabel,
  value,
}: {
  checked: boolean
  confirmLookaheadValue: number
  crossChecked: boolean
  crossLabel: string
  label: string
  lookbackLabel: string
  lookbackValue: number
  onCrossCheckedChange: (checked: boolean) => void
  onCheckedChange: (checked: boolean) => void
  onConfirmLookaheadChange: (value: number) => void
  onLookbackChange: (value: number) => void
  onTradeCheckedChange: (checked: boolean) => void
  onValueChange: (value: number) => void
  tradeChecked: boolean
  tradeLabel: string
  value: number
}) {
  return (
    <div className="ff-indicators-mmf-v2-panel__signal-block">
      <div className="ff-indicators-mmf-v2-panel__check-row">
        <CheckControl checked={checked} label={label} onChange={onCheckedChange} />
      </div>
      <div className="ff-indicators-mmf-v2-panel__advance-row">
        <span className="ff-indicators-mmf-v2-panel__advance-label">{lookbackLabel}</span>
        <span className="ff-indicators-mmf-panel-v1__vdo-input ff-indicators-mmf-v2-panel__advance-input">
          <NumberBox
            formatValue={(numberValue) => String(Math.round(numberValue))}
            max={200}
            min={1}
            onChange={onLookbackChange}
            parseValue={(inputValue) => Number(inputValue)}
            step={1}
            value={Number(lookbackValue)}
          />
        </span>
        <span className="ff-indicators-mmf-v2-panel__trade-toggle-inline">
          <CheckControl checked={crossChecked} label={crossLabel} onChange={onCrossCheckedChange} />
        </span>
      </div>
      <div className="ff-indicators-mmf-v2-panel__advance-row">
        <span className="ff-indicators-mmf-v2-panel__advance-label">Stoch %K</span>
        <span className="ff-indicators-mmf-panel-v1__vdo-input ff-indicators-mmf-v2-panel__advance-input">
          <NumberBox
            formatValue={(numberValue) => numberValue.toFixed(1).replace(/\.0$/, '')}
            max={100}
            min={0}
            onChange={onValueChange}
            parseValue={(inputValue) => Number(inputValue)}
            step={0.5}
            value={Number(value)}
          />
        </span>
        <span className="ff-indicators-mmf-v2-panel__trade-toggle-inline">
          <CheckControl checked={tradeChecked} label={tradeLabel} onChange={onTradeCheckedChange} />
        </span>
      </div>
      <div className="ff-indicators-mmf-v2-panel__advance-row">
        <span className="ff-indicators-mmf-v2-panel__advance-label">{'\u786e\u8ba4\u8303\u56f4'}</span>
        <span className="ff-indicators-mmf-panel-v1__vdo-input ff-indicators-mmf-v2-panel__advance-input">
          <NumberBox
            formatValue={(numberValue) => String(Math.round(numberValue))}
            max={200}
            min={1}
            onChange={onConfirmLookaheadChange}
            parseValue={(inputValue) => Number(inputValue)}
            step={1}
            value={Number(confirmLookaheadValue)}
          />
        </span>
      </div>
    </div>
  )
}

export function MmfV2StylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
}) {
  const patch = (next: Partial<MmfIndicatorSettings>) => onSettingsChange(updateMmfSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-mmf-style-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <MmfMarkerStyleRow
          color={settings.highColor}
          label={'\u9ad8\u70b9'}
          onColorChange={(highColor) => patch({ highColor })}
          onSizeChange={(highSize) => patch({ highSize })}
          onSymbolChange={(highSymbol) => patch({ highSymbol })}
          size={settings.highSize}
          symbol={settings.highSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.deadCrossColor}
          label={'\u6b7b\u53c9'}
          onColorChange={(deadCrossColor) => patch({ deadCrossColor })}
          onSizeChange={(deadCrossSize) => patch({ deadCrossSize })}
          onSymbolChange={(deadCrossSymbol) => patch({ deadCrossSymbol })}
          options={mmfCrossSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.deadCrossSize}
          symbol={settings.deadCrossSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.lowColor}
          label={'\u4f4e\u70b9'}
          onColorChange={(lowColor) => patch({ lowColor })}
          onSizeChange={(lowSize) => patch({ lowSize })}
          onSymbolChange={(lowSymbol) => patch({ lowSymbol })}
          size={settings.lowSize}
          symbol={settings.lowSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.supportColor}
          label={'\u652f\u6491\u4f4d'}
          onColorChange={(supportColor) => patch({ supportColor })}
          onSizeChange={(supportSize) => patch({ supportSize })}
          onSymbolChange={(supportSymbol) => patch({ supportSymbol })}
          size={settings.supportSize}
          symbol={settings.supportSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.resistanceColor}
          label={'\u963b\u529b\u4f4d'}
          onColorChange={(resistanceColor) => patch({ resistanceColor })}
          onSizeChange={(resistanceSize) => patch({ resistanceSize })}
          onSymbolChange={(resistanceSymbol) => patch({ resistanceSymbol })}
          size={settings.resistanceSize}
          symbol={settings.resistanceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.goldenCrossColor}
          label={'\u91d1\u53c9'}
          onColorChange={(goldenCrossColor) => patch({ goldenCrossColor })}
          onSizeChange={(goldenCrossSize) => patch({ goldenCrossSize })}
          onSymbolChange={(goldenCrossSymbol) => patch({ goldenCrossSymbol })}
          options={mmfCrossSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.goldenCrossSize}
          symbol={settings.goldenCrossSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.highConfirmPointColor}
          label={'\u9ad8\u70b9\u786e\u8ba4\u70b9'}
          onColorChange={(highConfirmPointColor) => patch({ highConfirmPointColor })}
          onSizeChange={(highConfirmPointSize) => patch({ highConfirmPointSize })}
          onSymbolChange={(highConfirmPointSymbol) => patch({ highConfirmPointSymbol })}
          options={mmfTradeArrowSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.highConfirmPointSize}
          symbol={settings.highConfirmPointSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.lowConfirmPointColor}
          label={'\u4f4e\u70b9\u786e\u8ba4\u70b9'}
          onColorChange={(lowConfirmPointColor) => patch({ lowConfirmPointColor })}
          onSizeChange={(lowConfirmPointSize) => patch({ lowConfirmPointSize })}
          onSymbolChange={(lowConfirmPointSymbol) => patch({ lowConfirmPointSymbol })}
          options={mmfTradeArrowSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.lowConfirmPointSize}
          symbol={settings.lowConfirmPointSymbol}
        />
      </section>
    </div>
  )
}

