import { useState } from 'react'
import type { ReactNode } from 'react'
import type { MmfIndicatorSettings } from '../../indicatorPersistence'
import type { SymbolSelectSize } from '../../../controls/SymbolSelect'
import type { MmfV2ArbitrageBacktestStats, MmfV2MomentumSample, MmfV2MomentumStats, MmfV2MomentumStatsSide, MmfV2RangeDistanceStats } from '../../../chart/mmfV2MomentumStats'
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
              checked={settings.showExpectedSupportLevel}
              label={'\u9884\u671f\u652f\u6491\u4f4d'}
              onChange={(showExpectedSupportLevel) => patch({ showExpectedSupportLevel })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showSupportDownBreakPoint}
              label={'\u652f\u6491\u4f4d\u5411\u4e0b\u7a81\u7834 - \u4e0b\u964d\u8d8b\u52bf\u5f00\u542f'}
              onChange={(showSupportDownBreakPoint) => patch({ showSupportDownBreakPoint })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showSupportUpBreakPoint}
              label={'\u652f\u6491\u4f4d\u5411\u4e0a\u7a81\u7834 - \u4e0b\u964d\u8d8b\u52bf\u5173\u95ed'}
              onChange={(showSupportUpBreakPoint) => patch({ showSupportUpBreakPoint })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showResistanceLevel}
              label={'\u963b\u529b\u4f4d'}
              onChange={(showResistanceLevel) => patch({ showResistanceLevel })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showExpectedResistanceLevel}
              label={'\u9884\u671f\u963b\u529b\u4f4d'}
              onChange={(showExpectedResistanceLevel) => patch({ showExpectedResistanceLevel })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showResistanceUpBreakPoint}
              label={'\u963b\u529b\u4f4d\u5411\u4e0a\u7a81\u7834 - \u4e0a\u5347\u8d8b\u52bf\u5f00\u542f'}
              onChange={(showResistanceUpBreakPoint) => patch({ showResistanceUpBreakPoint })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showResistanceDownBreakPoint}
              label={'\u963b\u529b\u4f4d\u5411\u4e0b\u7a81\u7834 - \u4e0a\u5347\u8d8b\u52bf\u5173\u95ed'}
              onChange={(showResistanceDownBreakPoint) => patch({ showResistanceDownBreakPoint })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showTrendDownReboundPoint}
              label={'\u4e0b\u964d\u8d8b\u52bf - \u53cd\u5f39\u70b9'}
              onChange={(showTrendDownReboundPoint) => patch({ showTrendDownReboundPoint })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showTrendDownReturnPoint}
              label={'\u4e0b\u964d\u8d8b\u52bf - \u56de\u5f52\u70b9'}
              onChange={(showTrendDownReturnPoint) => patch({ showTrendDownReturnPoint })}
            />
          </div>
          <MmfV2MorganThresholdRow
            onChange={(trendDownReturnMorganRatio) => patch({ trendDownReturnMorganRatio })}
            value={settings.trendDownReturnMorganRatio}
          />
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showTrendDownDivergencePointV2}
              label={'\u4e0b\u964d\u8d8b\u52bf - \u80cc\u79bb\u70b9'}
              onChange={(showTrendDownDivergencePointV2) => patch({ showTrendDownDivergencePointV2 })}
            />
          </div>
          <MmfV2MorganThresholdRow
            onChange={(trendDownDivergenceMorganRatio) => patch({ trendDownDivergenceMorganRatio })}
            value={settings.trendDownDivergenceMorganRatio}
          />
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showTrendUpPullbackPoint}
              label={'\u4e0a\u5347\u8d8b\u52bf - \u56de\u64a4\u70b9'}
              onChange={(showTrendUpPullbackPoint) => patch({ showTrendUpPullbackPoint })}
            />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showTrendUpReturnPoint}
              label={'\u4e0a\u5347\u8d8b\u52bf - \u56de\u5f52\u70b9'}
              onChange={(showTrendUpReturnPoint) => patch({ showTrendUpReturnPoint })}
            />
          </div>
          <MmfV2MorganThresholdRow
            onChange={(trendUpReturnMorganRatio) => patch({ trendUpReturnMorganRatio })}
            value={settings.trendUpReturnMorganRatio}
          />
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl
              checked={settings.showTrendUpDivergencePointV2}
              label={'\u4e0a\u5347\u8d8b\u52bf - \u80cc\u79bb\u70b9'}
              onChange={(showTrendUpDivergencePointV2) => patch({ showTrendUpDivergencePointV2 })}
            />
          </div>
          <MmfV2MorganThresholdRow
            onChange={(trendUpDivergenceMorganRatio) => patch({ trendUpDivergenceMorganRatio })}
            value={settings.trendUpDivergenceMorganRatio}
          />
        </div>
      </section>
    </div>
  )
}

function MmfV2MorganThresholdRow({
  onChange,
  value,
}: {
  onChange: (value: number) => void
  value: number
}) {
  return (
    <div className="ff-indicators-mmf-v2-panel__advance-row">
      <span className="ff-indicators-mmf-v2-panel__advance-label">
        {'\u6469\u6839\u533a\u95f4 '}
        <span className="ff-indicators-mmf-v2-panel__advance-label-part--compact">{'\u9608\u503c'}</span>
      </span>
      <span className="ff-indicators-mmf-panel-v1__vdo-input ff-indicators-mmf-v2-panel__advance-input">
        <NumberBox
          formatValue={(numberValue) => numberValue.toFixed(3).replace(/\.?0+$/, '')}
          max={1}
          min={0}
          onChange={onChange}
          parseValue={(inputValue) => Number(inputValue)}
          step={0.001}
          value={Number(value)}
        />
      </span>
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
          color={settings.expectedSupportColor}
          label={'\u9884\u671f\u652f\u6491\u4f4d'}
          onColorChange={(expectedSupportColor) => patch({ expectedSupportColor })}
          onSizeChange={(expectedSupportSize) => patch({ expectedSupportSize })}
          onSymbolChange={(expectedSupportSymbol) => patch({ expectedSupportSymbol })}
          size={settings.expectedSupportSize}
          symbol={settings.expectedSupportSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.supportUpBreakColor}
          label={'\u652f\u6491\u4f4d\u5411\u4e0a\u7a81\u7834'}
          onColorChange={(supportUpBreakColor) => patch({ supportUpBreakColor })}
          onSizeChange={(supportUpBreakSize) => patch({ supportUpBreakSize })}
          onSymbolChange={(supportUpBreakSymbol) => patch({ supportUpBreakSymbol })}
          size={settings.supportUpBreakSize}
          symbol={settings.supportUpBreakSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.supportDownBreakColor}
          label={'\u652f\u6491\u4f4d\u5411\u4e0b\u7a81\u7834'}
          onColorChange={(supportDownBreakColor) => patch({ supportDownBreakColor })}
          onSizeChange={(supportDownBreakSize) => patch({ supportDownBreakSize })}
          onSymbolChange={(supportDownBreakSymbol) => patch({ supportDownBreakSymbol })}
          size={settings.supportDownBreakSize}
          symbol={settings.supportDownBreakSymbol}
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
          color={settings.expectedResistanceColor}
          label={'\u9884\u671f\u963b\u529b\u4f4d'}
          onColorChange={(expectedResistanceColor) => patch({ expectedResistanceColor })}
          onSizeChange={(expectedResistanceSize) => patch({ expectedResistanceSize })}
          onSymbolChange={(expectedResistanceSymbol) => patch({ expectedResistanceSymbol })}
          size={settings.expectedResistanceSize}
          symbol={settings.expectedResistanceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.resistanceDownBreakColor}
          label={'\u963b\u529b\u4f4d\u5411\u4e0b\u7a81\u7834'}
          onColorChange={(resistanceDownBreakColor) => patch({ resistanceDownBreakColor })}
          onSizeChange={(resistanceDownBreakSize) => patch({ resistanceDownBreakSize })}
          onSymbolChange={(resistanceDownBreakSymbol) => patch({ resistanceDownBreakSymbol })}
          size={settings.resistanceDownBreakSize}
          symbol={settings.resistanceDownBreakSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.resistanceUpBreakColor}
          label={'\u963b\u529b\u4f4d\u5411\u4e0a\u7a81\u7834'}
          onColorChange={(resistanceUpBreakColor) => patch({ resistanceUpBreakColor })}
          onSizeChange={(resistanceUpBreakSize) => patch({ resistanceUpBreakSize })}
          onSymbolChange={(resistanceUpBreakSymbol) => patch({ resistanceUpBreakSymbol })}
          size={settings.resistanceUpBreakSize}
          symbol={settings.resistanceUpBreakSymbol}
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
          color={settings.trendDownReturnColor}
          label={'\u4e0b\u964d\u8d8b\u52bf - \u56de\u5f52\u70b9'}
          onColorChange={(trendDownReturnColor) => patch({ trendDownReturnColor })}
          onSizeChange={(trendDownReturnSize) => patch({ trendDownReturnSize })}
          onSymbolChange={(trendDownReturnSymbol) => patch({ trendDownReturnSymbol })}
          size={settings.trendDownReturnSize}
          symbol={settings.trendDownReturnSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendDownDivergencePointColor}
          label={'\u4e0b\u964d\u8d8b\u52bf - \u80cc\u79bb\u70b9'}
          onColorChange={(trendDownDivergencePointColor) => patch({ trendDownDivergencePointColor })}
          onSizeChange={(trendDownDivergencePointSize) => patch({ trendDownDivergencePointSize })}
          onSymbolChange={(trendDownDivergencePointSymbol) => patch({ trendDownDivergencePointSymbol })}
          size={settings.trendDownDivergencePointSize}
          symbol={settings.trendDownDivergencePointSymbol}
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
          color={settings.trendUpReturnColor}
          label={'\u4e0a\u5347\u8d8b\u52bf - \u56de\u5f52\u70b9'}
          onColorChange={(trendUpReturnColor) => patch({ trendUpReturnColor })}
          onSizeChange={(trendUpReturnSize) => patch({ trendUpReturnSize })}
          onSymbolChange={(trendUpReturnSymbol) => patch({ trendUpReturnSymbol })}
          size={settings.trendUpReturnSize}
          symbol={settings.trendUpReturnSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendUpDivergencePointColor}
          label={'\u4e0a\u5347\u8d8b\u52bf - \u80cc\u79bb\u70b9'}
          onColorChange={(trendUpDivergencePointColor) => patch({ trendUpDivergencePointColor })}
          onSizeChange={(trendUpDivergencePointSize) => patch({ trendUpDivergencePointSize })}
          onSymbolChange={(trendUpDivergencePointSymbol) => patch({ trendUpDivergencePointSymbol })}
          size={settings.trendUpDivergencePointSize}
          symbol={settings.trendUpDivergencePointSymbol}
        />
      </section>
    </div>
  )
}

export function MmfV2StrategyPanel({
  momentumCrosshairIndex,
  momentumStats,
  onSettingsChange,
  settings,
}: {
  momentumCrosshairIndex?: number | null
  momentumStats?: MmfV2MomentumStats | null
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
}) {
  const patch = (next: Partial<MmfIndicatorSettings>) => onSettingsChange(updateMmfSettings(settings, next))
  const showMomentumStats = Number(settings.vdoMomentumUpLookback) > 0 || Number(settings.vdoMomentumDownLookback) > 0
  const showBreakoutMomentumStats = Number(settings.vdoBreakoutMomentumUpLookback) > 0 || Number(settings.vdoBreakoutMomentumDownLookback) > 0
  const showCloseMomentumStats = Number(settings.vdoCloseMomentumUpLookback) > 0 || Number(settings.vdoCloseMomentumDownLookback) > 0

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mmf-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section ff-indicators-mmf-panel-v1__scroll-section">
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <span className="ff-indicators-mmf-v2-panel__advance-label">{'VDO \u9ad8\u4f4e\u70b9\u52a8\u91cf'}</span>
          </div>
          {showMomentumStats ? (
            <MmfV2MomentumStatsCard
              currentDownLabel={'\u5411\u4e0b\u52a8\u91cf'}
              currentUpLabel={'\u5411\u4e0a\u52a8\u91cf'}
              downLookback={settings.vdoMomentumDownLookback}
              downStats={momentumStats?.down ?? null}
              downTitle={'\u9ad8\u70b9\u5230\u786e\u8ba4\u503c'}
              momentumCrosshairIndex={momentumCrosshairIndex}
              periodSeconds={momentumStats?.periodSeconds ?? 60}
              upMomentumLabel={'VDO \u5411\u4e0a\u52a8\u91cf'}
              upStats={momentumStats?.up ?? null}
              downMomentumLabel={'VDO \u5411\u4e0b\u52a8\u91cf'}
              upLookback={settings.vdoMomentumUpLookback}
              upTitle={'\u4f4e\u70b9\u5230\u786e\u8ba4\u503c'}
            />
          ) : null}
          <MmfV2MomentumRow
            label={'\u4e0a\u5347\u52a8\u91cf'}
            lookback={settings.vdoMomentumUpLookback}
            onLookbackChange={(vdoMomentumUpLookback) => patch({ vdoMomentumUpLookback })}
          />
          <MmfV2MomentumRow
            label={'\u4e0b\u964d\u52a8\u91cf'}
            lookback={settings.vdoMomentumDownLookback}
            onLookbackChange={(vdoMomentumDownLookback) => patch({ vdoMomentumDownLookback })}
          />
        </div>
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <span className="ff-indicators-mmf-v2-panel__advance-label">{'VDO \u7a81\u7834\u70b9\u52a8\u91cf'}</span>
          </div>
          {showBreakoutMomentumStats ? (
            <MmfV2MomentumStatsCard
              currentDownLabel={'\u5411\u4e0b\u7a81\u7834\u52a8\u91cf'}
              currentUpLabel={'\u5411\u4e0a\u7a81\u7834\u52a8\u91cf'}
              downLookback={settings.vdoBreakoutMomentumDownLookback}
              downMomentumLabel={'VDO \u5411\u4e0b\u7a81\u7834\u52a8\u91cf'}
              downStats={momentumStats?.breakoutDown ?? null}
              downTitle={'\u5411\u4e0b\u7a81\u7834\u70b9\u5230\u9ad8\u70b9'}
              momentumCrosshairIndex={momentumCrosshairIndex}
              periodSeconds={momentumStats?.periodSeconds ?? 60}
              upLookback={settings.vdoBreakoutMomentumUpLookback}
              upMomentumLabel={'VDO \u5411\u4e0a\u7a81\u7834\u52a8\u91cf'}
              upStats={momentumStats?.breakoutUp ?? null}
              upTitle={'\u5411\u4e0a\u7a81\u7834\u70b9\u5230\u4f4e\u70b9'}
            />
          ) : null}
          <MmfV2MomentumRow
            label={'\u5411\u4e0a\u7a81\u7834\u52a8\u91cf'}
            lookback={settings.vdoBreakoutMomentumUpLookback}
            onLookbackChange={(vdoBreakoutMomentumUpLookback) => patch({ vdoBreakoutMomentumUpLookback })}
          />
          <MmfV2MomentumRow
            label={'\u5411\u4e0b\u7a81\u7834\u52a8\u91cf'}
            lookback={settings.vdoBreakoutMomentumDownLookback}
            onLookbackChange={(vdoBreakoutMomentumDownLookback) => patch({ vdoBreakoutMomentumDownLookback })}
          />
        </div>
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <span className="ff-indicators-mmf-v2-panel__advance-label">{'VDO \u5173\u95ed\u70b9\u52a8\u91cf'}</span>
          </div>
          {showCloseMomentumStats ? (
            <MmfV2MomentumStatsCard
              currentDownLabel={'\u5411\u4e0b\u5173\u95ed\u52a8\u91cf'}
              currentUpLabel={'\u5411\u4e0a\u5173\u95ed\u52a8\u91cf'}
              downLookback={settings.vdoCloseMomentumDownLookback}
              downMomentumLabel={'VDO \u5411\u4e0b\u5173\u95ed\u52a8\u91cf'}
              downStats={momentumStats?.closeDown ?? null}
              downTitle={'\u5411\u4e0b\u5173\u95ed\u70b9\u5230\u9ad8\u70b9'}
              momentumCrosshairIndex={momentumCrosshairIndex}
              periodSeconds={momentumStats?.periodSeconds ?? 60}
              upLookback={settings.vdoCloseMomentumUpLookback}
              upMomentumLabel={'VDO \u5411\u4e0a\u5173\u95ed\u52a8\u91cf'}
              upStats={momentumStats?.closeUp ?? null}
              upTitle={'\u5411\u4e0a\u5173\u95ed\u70b9\u5230\u4f4e\u70b9'}
            />
          ) : null}
          <MmfV2MomentumRow
            label={'\u5411\u4e0a\u5173\u95ed\u52a8\u91cf'}
            lookback={settings.vdoCloseMomentumUpLookback}
            onLookbackChange={(vdoCloseMomentumUpLookback) => patch({ vdoCloseMomentumUpLookback })}
          />
          <MmfV2MomentumRow
            label={'\u5411\u4e0b\u5173\u95ed\u52a8\u91cf'}
            lookback={settings.vdoCloseMomentumDownLookback}
            onLookbackChange={(vdoCloseMomentumDownLookback) => patch({ vdoCloseMomentumDownLookback })}
          />
        </div>
        <label className="ff-indicators-mmf-v2-momentum-floating-toggle">
          <input
            checked={settings.showVdoMomentumFloatingPanel !== false}
            onChange={(event) => patch({ showVdoMomentumFloatingPanel: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>{'\u663e\u793a\u6d6e\u52a8\u9762\u677f'}</span>
        </label>
      </section>
    </div>
  )
}

export function MmfV2ArbitrageStrategyPanel({
  momentumStats,
  onSettingsChange,
  settings,
}: {
  momentumStats?: MmfV2MomentumStats | null
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
}) {
  const patch = (next: Partial<MmfIndicatorSettings>) => onSettingsChange(updateMmfSettings(settings, next))
  const [shortTestResult, setShortTestResult] = useState<string | null>(null)
  const [longTestResult, setLongTestResult] = useState<string | null>(null)

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mmf-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section ff-indicators-mmf-panel-v1__scroll-section">
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <span className="ff-indicators-mmf-v2-panel__advance-label">{'\u9707\u8361\u5957\u5229\u7b56\u7565'}</span>
          </div>
          <div className="ff-indicators-mmf-v2-momentum-card">
            <MmfV2RangeDistanceStatsSection
              stats={momentumStats?.arbitrageDownClose ?? null}
              title={'\u4e0b\u964d\u8d8b\u52bf\u5173\u95ed'}
            />
            <MmfV2RangeDistanceStatsSection
              stats={momentumStats?.arbitrageUpClose ?? null}
              title={'\u4e0a\u5347\u8d8b\u52bf\u5173\u95ed'}
            />
          </div>
        </div>
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <span className="ff-indicators-mmf-v2-panel__advance-label">{'\u7b56\u7565\u56de\u6d4b\u53c2\u6570'}</span>
          </div>
          <MmfV2TradeParameterRow
            closeMode={settings.arbitrageShortCloseMode}
            entryMomentum={settings.arbitrageShortEntryMomentum}
            firstPointLabel={'\u7b2c\u4e00\u4e2a\u4f4e\u70b9\u5e73\u4ed3'}
            label={'\u7a7a\u5934'}
            onCloseModeChange={(arbitrageShortCloseMode) => patch({ arbitrageShortCloseMode })}
            onEntryMomentumChange={(arbitrageShortEntryMomentum) => patch({ arbitrageShortEntryMomentum })}
            onPositionChange={(arbitrageShortPosition) => patch({ arbitrageShortPosition })}
            onStopLossChange={(arbitrageShortStopLoss) => patch({ arbitrageShortStopLoss })}
            onStochExitThresholdChange={(arbitrageShortStochExitThreshold) => patch({ arbitrageShortStochExitThreshold })}
            onTakeProfitChange={(arbitrageShortTakeProfit) => patch({ arbitrageShortTakeProfit })}
            onTest={() => setShortTestResult(formatBacktestResult(momentumStats?.arbitrageShortBacktest))}
            position={settings.arbitrageShortPosition}
            stopLoss={settings.arbitrageShortStopLoss}
            stochExitLabel={'\u968f\u673a\u6307\u6570\uff0c\u5411\u4e0a\u7a81\u7834'}
            stochExitThreshold={settings.arbitrageShortStochExitThreshold}
            takeProfit={settings.arbitrageShortTakeProfit}
          />
          <MmfV2StrategyResultCard label={'\u7a7a\u5934'} result={shortTestResult} />
          <MmfV2TradeParameterRow
            closeMode={settings.arbitrageLongCloseMode}
            entryMomentum={settings.arbitrageLongEntryMomentum}
            firstPointLabel={'\u7b2c\u4e00\u4e2a\u9ad8\u70b9\u5e73\u4ed3'}
            label={'\u591a\u5934'}
            onCloseModeChange={(arbitrageLongCloseMode) => patch({ arbitrageLongCloseMode })}
            onEntryMomentumChange={(arbitrageLongEntryMomentum) => patch({ arbitrageLongEntryMomentum })}
            onPositionChange={(arbitrageLongPosition) => patch({ arbitrageLongPosition })}
            onStopLossChange={(arbitrageLongStopLoss) => patch({ arbitrageLongStopLoss })}
            onStochExitThresholdChange={(arbitrageLongStochExitThreshold) => patch({ arbitrageLongStochExitThreshold })}
            onTakeProfitChange={(arbitrageLongTakeProfit) => patch({ arbitrageLongTakeProfit })}
            onTest={() => setLongTestResult(formatBacktestResult(momentumStats?.arbitrageLongBacktest))}
            position={settings.arbitrageLongPosition}
            stopLoss={settings.arbitrageLongStopLoss}
            stochExitLabel={'\u968f\u673a\u6307\u6570\uff0c\u5411\u4e0b\u7a81\u7834'}
            stochExitThreshold={settings.arbitrageLongStochExitThreshold}
            takeProfit={settings.arbitrageLongTakeProfit}
          />
          <MmfV2StrategyResultCard label={'\u591a\u5934'} result={longTestResult} />
        </div>
      </section>
    </div>
  )
}

function formatBacktestResult(stats?: MmfV2ArbitrageBacktestStats | null) {
  if (!stats || stats.samples <= 0 || stats.winRate == null) return '\u6682\u65e0\u53ef\u8ba1\u7b97\u4ea4\u6613'
  return `\u76c8\u5229\uff1a${stats.wins.toLocaleString()} \u6b21\uff0c\u6b62\u635f\uff1a${stats.losses.toLocaleString()} \u6b21\uff0c\u80dc\u7387\uff1a${formatPercent(stats.winRate)}\uff0c\u671f\u671b\u503c\uff1a${formatMoney(stats.expectedValue)}\uff0c\u4f59\u989d\uff1a${formatMoney(stats.balance)}`
}

function formatPercent(value: number | null) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(2).replace(/\.?0+$/, '')}%`
}

function formatMoney(value: number | null) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toFixed(2).replace(/\.?0+$/, '')
}

function MmfV2StrategyResultCard({
  label,
  result,
}: {
  label: string
  result?: string | null
}) {
  return (
    <div className="ff-indicators-mmf-v2-momentum-card ff-indicators-mmf-v2-strategy-result-card">
      <div className="ff-indicators-mmf-v2-momentum-card__section">
        <strong>{`${label}\u56de\u6d4b\u7ed3\u679c`}</strong>
        <span>{result ?? '\u6682\u672a\u63a5\u5165\u7b56\u7565\u7b97\u6cd5'}</span>
      </div>
    </div>
  )
}

function MmfV2TradeParameterRow({
  closeMode,
  entryMomentum,
  firstPointLabel,
  label,
  onCloseModeChange,
  onEntryMomentumChange,
  onPositionChange,
  onStopLossChange,
  onStochExitThresholdChange,
  onTakeProfitChange,
  onTest,
  position,
  stopLoss,
  stochExitLabel,
  stochExitThreshold,
  takeProfit,
}: {
  closeMode: MmfIndicatorSettings['arbitrageLongCloseMode']
  entryMomentum: number
  firstPointLabel: string
  label: string
  onCloseModeChange: (value: MmfIndicatorSettings['arbitrageLongCloseMode']) => void
  onEntryMomentumChange: (value: number) => void
  onPositionChange: (value: number) => void
  onStopLossChange: (value: number) => void
  onStochExitThresholdChange: (value: number) => void
  onTakeProfitChange: (value: number) => void
  onTest: () => void
  position: number
  stopLoss: number
  stochExitLabel: string
  stochExitThreshold: number
  takeProfit: number
}) {
  return (
    <div className="ff-indicators-mmf-v2-trade-parameter-group">
      <strong>{label}</strong>
      <div className="ff-indicators-mmf-v2-trade-parameter-row">
        <span className="ff-indicators-mmf-v2-trade-parameter-field">
          <span>{'\u5efa\u4ed3 \u52a8\u91cf'}</span>
          <MmfV2StrategyNumberBox onChange={onEntryMomentumChange} value={entryMomentum} />
        </span>
        <span className="ff-indicators-mmf-v2-trade-parameter-field">
          <span>{'\u4ed3\u4f4d'}</span>
          <MmfV2StrategyNumberBox onChange={onPositionChange} value={position} />
        </span>
        <span className="ff-indicators-mmf-v2-trade-parameter-field">
          <span>{'\u6b62\u635f'}</span>
          <MmfV2StrategyNumberBox onChange={onStopLossChange} value={stopLoss} />
        </span>
        <MmfV2CloseModeRow
          checked={closeMode === 'target'}
          label={'\u5e73\u4ed3'}
          mode="target"
          onModeChange={onCloseModeChange}
        >
          <MmfV2StrategyNumberBox onChange={onTakeProfitChange} value={takeProfit} />
        </MmfV2CloseModeRow>
        <MmfV2CloseModeRow
          checked={closeMode === 'point'}
          label={`\u5e73\u4ed3\uff1a${firstPointLabel}`}
          mode="point"
          onModeChange={onCloseModeChange}
        />
        <MmfV2CloseModeRow
          checked={closeMode === 'stoch'}
          label={`\u5e73\u4ed3\uff1a${stochExitLabel}`}
          mode="stoch"
          onModeChange={onCloseModeChange}
        >
          <MmfV2StrategyNumberBox min={-500} onChange={onStochExitThresholdChange} value={stochExitThreshold} />
        </MmfV2CloseModeRow>
        <button className="ff-indicators-mmf-v2-strategy-test-button" onClick={onTest} type="button">{'\u6d4b\u8bd5'}</button>
      </div>
    </div>
  )
}

function MmfV2CloseModeRow({
  checked,
  children,
  label,
  mode,
  onModeChange,
}: {
  checked: boolean
  children?: ReactNode
  label: string
  mode: MmfIndicatorSettings['arbitrageLongCloseMode']
  onModeChange: (value: MmfIndicatorSettings['arbitrageLongCloseMode']) => void
}) {
  return (
    <label className="ff-indicators-mmf-v2-close-mode-row">
      <input checked={checked} onChange={() => onModeChange(mode)} type="radio" />
      <span>{label}</span>
      {children}
    </label>
  )
}

function MmfV2StrategyNumberBox({
  min = 0,
  onChange,
  value,
}: {
  min?: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <span className="ff-indicators-mmf-v2-panel__strategy-input">
      <NumberBox
        formatValue={(numberValue) => String(numberValue)}
        min={min}
        onChange={onChange}
        parseValue={(inputValue) => Number(inputValue)}
        step={0.1}
        value={Number(value)}
      />
    </span>
  )
}

function MmfV2RangeDistanceStatsSection({
  stats,
  title,
}: {
  stats: MmfV2RangeDistanceStats | null
  title: string
}) {
  if (!stats) {
    return (
      <div className="ff-indicators-mmf-v2-momentum-card__section">
        <strong>{title}</strong>
        <span>{'\u9ad8\u70b9\u5230\u4f4e\u70b9\u7684\u8ddd\u79bb\uff1a\u6682\u65e0\u53ef\u8ba1\u7b97\u53d6\u503c'}</span>
      </div>
    )
  }

  return (
    <div className="ff-indicators-mmf-v2-momentum-card__section">
      <strong>{`${title}\uff1a${stats.samples.toLocaleString()} \u4e2a\u53d6\u503c`}</strong>
      <span>{`\u5468\u671f\uff1a${formatStatsDate(stats.startTime)} \u5f00\u59cb\uff0c${formatStatsDate(stats.endTime)} \u5173\u95ed`}</span>
      <span>{`\u9ad8\u70b9\u5230\u4f4e\u70b9\u7684\u8ddd\u79bb\uff1a\u6700\u5927\u503c ${formatDistance(stats.maxDistance)}\uff0c\u6700\u5c0f\u503c ${formatDistance(stats.minDistance)}\uff0c\u5e73\u5747\u503c ${formatDistance(stats.averageDistance)}`}</span>
      <span>{`\u52a8\u91cf\u5927\u4e8e 6 \u7684\u9ad8\u4f4e\u70b9\uff1a${stats.strongMomentumPoints.toLocaleString()} \u4e2a`}</span>
    </div>
  )
}

function MmfV2MomentumStatsCard({
  currentDownLabel,
  currentUpLabel,
  downLookback,
  downMomentumLabel,
  downStats,
  downTitle,
  momentumCrosshairIndex,
  periodSeconds,
  upMomentumLabel,
  upStats,
  upLookback,
  upTitle,
}: {
  currentDownLabel: string
  currentUpLabel: string
  downLookback: number
  downMomentumLabel: string
  downStats: MmfV2MomentumStatsSide | null
  downTitle: string
  momentumCrosshairIndex?: number | null
  periodSeconds: number
  upMomentumLabel: string
  upStats: MmfV2MomentumStatsSide | null
  upLookback: number
  upTitle: string
}) {
  const current = resolveCurrentMomentumSample(upStats, downStats, momentumCrosshairIndex, currentUpLabel, currentDownLabel)

  return (
    <div className="ff-indicators-mmf-v2-momentum-card">
      <div className="ff-indicators-mmf-v2-momentum-card__current">
        <strong>{'\u5f53\u524d\u503c'}</strong>
        <span>{current ? `${current.label} ${formatMomentum(current.sample.momentum)}` : '-'}</span>
      </div>
      {Number(upLookback) > 0 ? (
        <MmfV2MomentumStatsSection
          lookback={upLookback}
          momentumLabel={upMomentumLabel}
          periodSeconds={periodSeconds}
          stats={upStats}
          title={upTitle}
        />
      ) : null}
      {Number(downLookback) > 0 ? (
        <MmfV2MomentumStatsSection
          lookback={downLookback}
          momentumLabel={downMomentumLabel}
          periodSeconds={periodSeconds}
          stats={downStats}
          title={downTitle}
        />
      ) : null}
    </div>
  )
}

function resolveCurrentMomentumSample(upStats: MmfV2MomentumStatsSide | null, downStats: MmfV2MomentumStatsSide | null, crosshairIndex: number | null | undefined, upLabel: string, downLabel: string): { label: string; sample: MmfV2MomentumSample } | null {
  const upSamples = upStats?.samplesList ?? []
  const downSamples = downStats?.samplesList ?? []
  const safeCrosshairIndex = Number.isFinite(Number(crosshairIndex)) ? Math.round(Number(crosshairIndex)) : null
  if (safeCrosshairIndex != null) {
    const upHit = upSamples.find((sample) => sample.markerIndex === safeCrosshairIndex)
    if (upHit) return { label: upLabel, sample: upHit }
    const downHit = downSamples.find((sample) => sample.markerIndex === safeCrosshairIndex)
    if (downHit) return { label: downLabel, sample: downHit }
  }
  const latest = [
    ...upSamples.map((sample) => ({ label: upLabel, sample })),
    ...downSamples.map((sample) => ({ label: downLabel, sample })),
  ].sort((left, right) => right.sample.entryIndex - left.sample.entryIndex)[0]
  return latest ?? null
}

function MmfV2MomentumStatsSection({
  lookback,
  momentumLabel,
  periodSeconds,
  stats,
  title,
}: {
  lookback: number
  momentumLabel: string
  periodSeconds: number
  stats: MmfV2MomentumStatsSide | null
  title: string
}) {
  const sampleText = `${Math.round(Number(lookback)).toLocaleString()} \u4e2a\u53d6\u503c`
  if (!stats) {
    return (
      <div className="ff-indicators-mmf-v2-momentum-card__section">
        <strong>{sampleText}</strong>
        <span>{`${title}\uff1a\u6682\u65e0\u53ef\u8ba1\u7b97\u53d6\u503c`}</span>
      </div>
    )
  }

  return (
    <div className="ff-indicators-mmf-v2-momentum-card__section">
      <strong>{`${stats.samples.toLocaleString()} / ${sampleText}`}</strong>
      <span>{`${title}\u6700\u5c0f\u8ddd\u79bb\uff1a${formatBarsDuration(stats.minBars, periodSeconds)}`}</span>
      <span>{`${title}\u6700\u5927\u8ddd\u79bb\uff1a${formatBarsDuration(stats.maxBars, periodSeconds)}`}</span>
      <span>{`${momentumLabel}\uff1a\u6700\u5927\u503c ${formatMomentum(stats.maxMomentum)}\uff0c\u6700\u5c0f\u503c ${formatMomentum(stats.minMomentum)}\uff0c\u5e73\u5747\u503c ${formatMomentum(stats.averageMomentum)}`}</span>
    </div>
  )
}

function formatBarsDuration(bars: number | null, periodSeconds: number) {
  if (!Number.isFinite(Number(bars))) return '-'
  const safeBars = Math.max(0, Math.round(Number(bars)))
  const seconds = safeBars * Math.max(1, Math.round(Number(periodSeconds) || 60))
  const minutes = seconds / 60
  return `${safeBars} \u6839K\u7ebf\uff0c${formatDurationNumber(minutes)} \u5206\u949f\uff0c${seconds.toLocaleString()} \u79d2`
}

function formatDurationNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function formatMomentum(value: number | null) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toFixed(2).replace(/\.?0+$/, '')
}

function formatDistance(value: number | null) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toFixed(2).replace(/\.?0+$/, '')
}

function formatStatsDate(value: number | null) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return '-'
  const date = new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000)
  if (Number.isNaN(date.getTime())) return '-'
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function MmfV2MomentumRow({
  label,
  lookback,
  onLookbackChange,
}: {
  label: string
  lookback: number
  onLookbackChange: (value: number) => void
}) {
  return (
    <div className="ff-indicators-mmf-v2-panel__advance-row ff-indicators-mmf-v2-panel__momentum-control-row">
      <span className="ff-indicators-mmf-v2-panel__advance-label">{label}</span>
      <span className="ff-indicators-mmf-v2-panel__advance-label ff-indicators-mmf-v2-panel__advance-label-part--compact">{'\u53d6\u503c'}</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-input ff-indicators-mmf-v2-panel__advance-input">
        <NumberBox
          formatValue={(numberValue) => String(Math.round(numberValue))}
          max={100000}
          min={0}
          onChange={onLookbackChange}
          parseValue={(inputValue) => Number(inputValue)}
          step={1}
          value={Number(lookback)}
        />
      </span>
    </div>
  )
}

