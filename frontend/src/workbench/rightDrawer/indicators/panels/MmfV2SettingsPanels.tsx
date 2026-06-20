import type { MmfIndicatorSettings } from '../../indicatorPersistence'
import type { SymbolSelectSize } from '../../../controls/SymbolSelect'
import { mmfCrossSymbolOptions, mmfTradeArrowSymbolOptions } from '../../stickerSymbols'
import { CheckControl, NumberBox } from './IndicatorSettingControls'
import { updateMmfSettings } from './indicatorPanelShared'
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
        <h3 className="ff-indicators-input-panel-v1__section-title ff-indicators-mmf-v2-panel__group-title">{'Stoch \u9ad8/\u4f4e\u70b9'}</h3>
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
        <h3 className="ff-indicators-input-panel-v1__section-title ff-indicators-mmf-v2-panel__group-title">{'TSI \u4ea4\u53c9\u786e\u8ba4'}</h3>
        <MmfV2TsiCrossBlock
          checked={settings.showTsiDeadCrossPoint}
          confirmChecked={settings.showTsiDeadCrossConfirmPoint}
          confirmLabel={'\u663e\u793a\u6b7b\u53c9\u786e\u8ba4\u70b9'}
          confirmValue={settings.tsiDeadCrossConfirmDistance}
          label={'TSI - \u6b7b\u53c9'}
          onCheckedChange={(showTsiDeadCrossPoint) => patch({ showTsiDeadCrossPoint })}
          onConfirmCheckedChange={(showTsiDeadCrossConfirmPoint) => patch({ showTsiDeadCrossConfirmPoint })}
          onConfirmValueChange={(tsiDeadCrossConfirmDistance) => patch({ tsiDeadCrossConfirmDistance })}
        />
        <MmfV2TsiCrossBlock
          checked={settings.showTsiGoldenCrossPoint}
          confirmChecked={settings.showTsiGoldenCrossConfirmPoint}
          confirmLabel={'\u663e\u793a\u91d1\u53c9\u786e\u8ba4\u70b9'}
          confirmValue={settings.tsiGoldenCrossConfirmDistance}
          label={'TSI - \u91d1\u53c9'}
          onCheckedChange={(showTsiGoldenCrossPoint) => patch({ showTsiGoldenCrossPoint })}
          onConfirmCheckedChange={(showTsiGoldenCrossConfirmPoint) => patch({ showTsiGoldenCrossConfirmPoint })}
          onConfirmValueChange={(tsiGoldenCrossConfirmDistance) => patch({ tsiGoldenCrossConfirmDistance })}
        />
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showResistanceLevel} label={'\u963b\u529b\u4f4d'} onChange={(showResistanceLevel) => patch({ showResistanceLevel })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showSupportLevel} label={'\u652f\u6491\u4f4d'} onChange={(showSupportLevel) => patch({ showSupportLevel })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showBullMarketPoint} label={'\u591a\u5934\u5e02\u573a'} onChange={(showBullMarketPoint) => patch({ showBullMarketPoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showBearMarketPoint} label={'\u7a7a\u5934\u5e02\u573a'} onChange={(showBearMarketPoint) => patch({ showBearMarketPoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showOverboughtPoint} label={'\u8d85\u4e70 - \u5f00\u542f'} onChange={(showOverboughtPoint) => patch({ showOverboughtPoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showOverboughtClosePoint} label={'\u8d85\u4e70 - \u5173\u95ed'} onChange={(showOverboughtClosePoint) => patch({ showOverboughtClosePoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showOversoldPoint} label={'\u8d85\u5356 - \u5f00\u542f'} onChange={(showOversoldPoint) => patch({ showOversoldPoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showOversoldClosePoint} label={'\u8d85\u5356 - \u5173\u95ed'} onChange={(showOversoldClosePoint) => patch({ showOversoldClosePoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showTopDivergencePoint} label={'\u9876\u80cc\u79bb'} onChange={(showTopDivergencePoint) => patch({ showTopDivergencePoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showBottomDivergencePoint} label={'\u5e95\u80cc\u79bb'} onChange={(showBottomDivergencePoint) => patch({ showBottomDivergencePoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showTrendUpPullbackPoint} label={'\u4e0a\u5347\u8d8b\u52bf - \u56de\u64a4\u70b9'} onChange={(showTrendUpPullbackPoint) => patch({ showTrendUpPullbackPoint })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showTrendDownReboundPoint} label={'\u4e0b\u964d\u8d8b\u52bf - \u53cd\u5f39\u70b9'} onChange={(showTrendDownReboundPoint) => patch({ showTrendDownReboundPoint })} />
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

function MmfV2TsiCrossBlock({
  checked,
  confirmChecked,
  confirmLabel,
  confirmValue,
  label,
  onCheckedChange,
  onConfirmCheckedChange,
  onConfirmValueChange,
}: {
  checked: boolean
  confirmChecked: boolean
  confirmLabel: string
  confirmValue: number
  label: string
  onCheckedChange: (checked: boolean) => void
  onConfirmCheckedChange: (checked: boolean) => void
  onConfirmValueChange: (value: number) => void
}) {
  return (
    <div className="ff-indicators-mmf-v2-panel__signal-block">
      <div className="ff-indicators-mmf-v2-panel__check-row">
        <CheckControl checked={checked} label={label} onChange={onCheckedChange} />
      </div>
      <div className="ff-indicators-mmf-v2-panel__advance-row">
        <span className="ff-indicators-mmf-v2-panel__advance-label">{'\u786e\u8ba4\u8303\u56f4'}</span>
        <span className="ff-indicators-mmf-panel-v1__vdo-input ff-indicators-mmf-v2-panel__advance-input">
          <NumberBox
            formatValue={(numberValue) => numberValue.toFixed(2).replace(/\.?0+$/, '')}
            max={1000}
            min={0}
            onChange={onConfirmValueChange}
            parseValue={(inputValue) => Number(inputValue)}
            step={0.1}
            value={Number(confirmValue)}
          />
        </span>
        <span className="ff-indicators-mmf-v2-panel__trade-toggle-inline">
          <CheckControl checked={confirmChecked} label={confirmLabel} onChange={onConfirmCheckedChange} />
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
          color={settings.resistanceColor}
          label={'\u963b\u529b\u4f4d'}
          onColorChange={(resistanceColor) => patch({ resistanceColor })}
          onSizeChange={(resistanceSize) => patch({ resistanceSize })}
          onSymbolChange={(resistanceSymbol) => patch({ resistanceSymbol })}
          size={settings.resistanceSize}
          symbol={settings.resistanceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.topDivergenceColor}
          label={'\u9876\u80cc\u79bb'}
          onColorChange={(topDivergenceColor) => patch({ topDivergenceColor })}
          onSizeChange={(topDivergenceSize) => patch({ topDivergenceSize })}
          onSymbolChange={(topDivergenceSymbol) => patch({ topDivergenceSymbol })}
          size={settings.topDivergenceSize}
          symbol={settings.topDivergenceSymbol}
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
          color={settings.bottomDivergenceColor}
          label={'\u5e95\u80cc\u79bb'}
          onColorChange={(bottomDivergenceColor) => patch({ bottomDivergenceColor })}
          onSizeChange={(bottomDivergenceSize) => patch({ bottomDivergenceSize })}
          onSymbolChange={(bottomDivergenceSymbol) => patch({ bottomDivergenceSymbol })}
          size={settings.bottomDivergenceSize}
          symbol={settings.bottomDivergenceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendUpPullbackColor}
          label={'\u4e0a\u5347\u8d8b\u52bf - \u56de\u64a4\u70b9'}
          onColorChange={(trendUpPullbackColor) => patch({ trendUpPullbackColor })}
          onSizeChange={(trendUpPullbackSize) => patch({ trendUpPullbackSize })}
          onSymbolChange={(trendUpPullbackSymbol) => patch({ trendUpPullbackSymbol })}
          size={settings.trendUpPullbackSize}
          symbol={settings.trendUpPullbackSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendDownReboundColor}
          label={'\u4e0b\u964d\u8d8b\u52bf - \u53cd\u5f39\u70b9'}
          onColorChange={(trendDownReboundColor) => patch({ trendDownReboundColor })}
          onSizeChange={(trendDownReboundSize) => patch({ trendDownReboundSize })}
          onSymbolChange={(trendDownReboundSymbol) => patch({ trendDownReboundSymbol })}
          size={settings.trendDownReboundSize}
          symbol={settings.trendDownReboundSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.bullMarketColor}
          label={'\u591a\u5934\u5e02\u573a'}
          onColorChange={(bullMarketColor) => patch({ bullMarketColor })}
          onSizeChange={(bullMarketSize) => patch({ bullMarketSize })}
          onSymbolChange={(bullMarketSymbol) => patch({ bullMarketSymbol })}
          size={settings.bullMarketSize}
          symbol={settings.bullMarketSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.bearMarketColor}
          label={'\u7a7a\u5934\u5e02\u573a'}
          onColorChange={(bearMarketColor) => patch({ bearMarketColor })}
          onSizeChange={(bearMarketSize) => patch({ bearMarketSize })}
          onSymbolChange={(bearMarketSymbol) => patch({ bearMarketSymbol })}
          size={settings.bearMarketSize}
          symbol={settings.bearMarketSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.overboughtColor}
          label={'\u8d85\u4e70 - \u5f00\u542f'}
          onColorChange={(overboughtColor) => patch({ overboughtColor })}
          onSizeChange={(overboughtSize) => patch({ overboughtSize })}
          onSymbolChange={(overboughtSymbol) => patch({ overboughtSymbol })}
          size={settings.overboughtSize}
          symbol={settings.overboughtSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.overboughtCloseColor}
          label={'\u8d85\u4e70 - \u5173\u95ed'}
          onColorChange={(overboughtCloseColor) => patch({ overboughtCloseColor })}
          onSizeChange={(overboughtCloseSize) => patch({ overboughtCloseSize })}
          onSymbolChange={(overboughtCloseSymbol) => patch({ overboughtCloseSymbol })}
          size={settings.overboughtCloseSize}
          symbol={settings.overboughtCloseSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.oversoldColor}
          label={'\u8d85\u5356 - \u5f00\u542f'}
          onColorChange={(oversoldColor) => patch({ oversoldColor })}
          onSizeChange={(oversoldSize) => patch({ oversoldSize })}
          onSymbolChange={(oversoldSymbol) => patch({ oversoldSymbol })}
          size={settings.oversoldSize}
          symbol={settings.oversoldSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.oversoldCloseColor}
          label={'\u8d85\u5356 - \u5173\u95ed'}
          onColorChange={(oversoldCloseColor) => patch({ oversoldCloseColor })}
          onSizeChange={(oversoldCloseSize) => patch({ oversoldCloseSize })}
          onSymbolChange={(oversoldCloseSymbol) => patch({ oversoldCloseSymbol })}
          size={settings.oversoldCloseSize}
          symbol={settings.oversoldCloseSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.tsiDeadCrossColor}
          label={'TSI - \u6b7b\u53c9'}
          onColorChange={(tsiDeadCrossColor) => patch({ tsiDeadCrossColor })}
          onSizeChange={(tsiDeadCrossSize) => patch({ tsiDeadCrossSize })}
          onSymbolChange={(tsiDeadCrossSymbol) => patch({ tsiDeadCrossSymbol })}
          options={mmfCrossSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.tsiDeadCrossSize}
          symbol={settings.tsiDeadCrossSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.tsiDeadCrossConfirmColor}
          label={'TSI - \u6b7b\u53c9\u786e\u8ba4\u70b9'}
          onColorChange={(tsiDeadCrossConfirmColor) => patch({ tsiDeadCrossConfirmColor })}
          onSizeChange={(tsiDeadCrossConfirmSize) => patch({ tsiDeadCrossConfirmSize })}
          onSymbolChange={(tsiDeadCrossConfirmSymbol) => patch({ tsiDeadCrossConfirmSymbol })}
          options={mmfTradeArrowSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.tsiDeadCrossConfirmSize}
          symbol={settings.tsiDeadCrossConfirmSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.tsiGoldenCrossColor}
          label={'TSI - \u91d1\u53c9'}
          onColorChange={(tsiGoldenCrossColor) => patch({ tsiGoldenCrossColor })}
          onSizeChange={(tsiGoldenCrossSize) => patch({ tsiGoldenCrossSize })}
          onSymbolChange={(tsiGoldenCrossSymbol) => patch({ tsiGoldenCrossSymbol })}
          options={mmfCrossSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.tsiGoldenCrossSize}
          symbol={settings.tsiGoldenCrossSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.tsiGoldenCrossConfirmColor}
          label={'TSI - \u91d1\u53c9\u786e\u8ba4\u70b9'}
          onColorChange={(tsiGoldenCrossConfirmColor) => patch({ tsiGoldenCrossConfirmColor })}
          onSizeChange={(tsiGoldenCrossConfirmSize) => patch({ tsiGoldenCrossConfirmSize })}
          onSymbolChange={(tsiGoldenCrossConfirmSymbol) => patch({ tsiGoldenCrossConfirmSymbol })}
          options={mmfTradeArrowSymbolOptions}
          resolveSize={resolveCompactSymbolSize}
          size={settings.tsiGoldenCrossConfirmSize}
          symbol={settings.tsiGoldenCrossConfirmSymbol}
        />
      </section>
    </div>
  )
}

