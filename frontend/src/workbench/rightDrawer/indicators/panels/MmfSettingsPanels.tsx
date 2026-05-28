import type { MmfIndicatorSettings } from '../../indicatorPersistence'
import { CheckControl, updateMmfSettings } from './indicatorPanelShared'
import {
  MmfMarkerStyleRow,
  MmfMorganOnlyRow,
  MmfSignalInputBlock,
  MmfToggleBlock,
  MmfVdoLimitRow,
  MmfVdoThresholdRow,
} from './MmfSettingsControls'

export function MmfInputPanel({
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
        <MmfSignalInputBlock
          checked={settings.showHigh}
          dpoMax={40}
          dpoMin={0}
          dpoValue={settings.dpoValue}
          label={'\u9ad8\u70b9'}
          morganMax={0.236}
          morganMin={0.118}
          morganRatio={settings.highMorganRatio}
          onCheckedChange={(showHigh) => patch({ showHigh })}
          onDpoChange={(dpoValue) => patch({ dpoValue })}
          onMorganRatioChange={(highMorganRatio) => patch({ highMorganRatio })}
        />
        <MmfSignalInputBlock
          checked={settings.showLow}
          dpoMax={0}
          dpoMin={-40}
          dpoValue={settings.lowDpoValue}
          label={'\u4f4e\u70b9'}
          morganMax={-0.118}
          morganMin={-0.236}
          morganRatio={settings.lowMorganRatio}
          onCheckedChange={(showLow) => patch({ showLow })}
          onDpoChange={(lowDpoValue) => patch({ lowDpoValue })}
          onMorganRatioChange={(lowMorganRatio) => patch({ lowMorganRatio })}
        />
        <MmfToggleBlock
          checked={settings.showLowPositionHighPoint}
          label={'\u4f4e\u4f4d\u9ad8\u70b9'}
          onChange={(showLowPositionHighPoint) => patch({ showLowPositionHighPoint })}
        />
        <MmfToggleBlock
          checked={settings.showHighPositionLowPoint}
          label={'\u9ad8\u4f4d\u4f4e\u70b9'}
          onChange={(showHighPositionLowPoint) => patch({ showHighPositionLowPoint })}
        />
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showUpBreakPoint}
              label={'\u5411\u4e0a\u65b9\u5411\u70b9'}
              onChange={(showUpBreakPoint) => patch({ showUpBreakPoint })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.upBreakVdoLower}
            onLowerChange={(upBreakVdoLower) => patch({ upBreakVdoLower })}
            onUpperChange={(upBreakVdoUpper) => patch({ upBreakVdoUpper })}
            upper={settings.upBreakVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showDownBreakPoint}
              label={'\u5411\u4e0b\u65b9\u5411\u70b9'}
              onChange={(showDownBreakPoint) => patch({ showDownBreakPoint })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.downBreakVdoLower}
            onLowerChange={(downBreakVdoLower) => patch({ downBreakVdoLower })}
            onUpperChange={(downBreakVdoUpper) => patch({ downBreakVdoUpper })}
            upper={settings.downBreakVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showResistanceLevel}
              label={'\u963b\u529b\u4f4d'}
              onChange={(showResistanceLevel) => patch({ showResistanceLevel })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.resistanceVdoLower}
            onLowerChange={(resistanceVdoLower) => patch({ resistanceVdoLower })}
            onUpperChange={(resistanceVdoUpper) => patch({ resistanceVdoUpper })}
            upper={settings.resistanceVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showSupportLevel}
              label={'\u652f\u6491\u4f4d'}
              onChange={(showSupportLevel) => patch({ showSupportLevel })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.supportVdoLower}
            onLowerChange={(supportVdoLower) => patch({ supportVdoLower })}
            onUpperChange={(supportVdoUpper) => patch({ supportVdoUpper })}
            upper={settings.supportVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendDownPoint}
              label={'\u8d8b\u52bf\u4e0b\u964d\u70b9'}
              onChange={(showTrendDownPoint) => patch({ showTrendDownPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(trendDownVdoUpper) => patch({ trendDownVdoUpper })}
            threshold={settings.trendDownVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendUpPoint}
              label={'\u8d8b\u52bf\u4e0a\u5347\u70b9'}
              onChange={(showTrendUpPoint) => patch({ showTrendUpPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(trendUpVdoUpper) => patch({ trendUpVdoUpper })}
            threshold={settings.trendUpVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showReboundPoint}
              label={'\u53cd\u5f39\u70b9'}
              onChange={(showReboundPoint) => patch({ showReboundPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(reboundVdoThreshold) => patch({ reboundVdoThreshold })}
            threshold={settings.reboundVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showPullbackPoint}
              label={'\u56de\u64a4\u70b9'}
              onChange={(showPullbackPoint) => patch({ showPullbackPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(pullbackVdoThreshold) => patch({ pullbackVdoThreshold })}
            threshold={settings.pullbackVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showOscLowDivergencePoint}
              label={'\u9707\u8361\u4f4e\u70b9 - \u52a8\u91cf\u80cc\u79bb'}
              onChange={(showOscLowDivergencePoint) => patch({ showOscLowDivergencePoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(oscLowDivergenceVdoThreshold) => patch({ oscLowDivergenceVdoThreshold })}
            threshold={settings.oscLowDivergenceVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showOscHighDivergencePoint}
              label={'\u9707\u8361\u9ad8\u70b9 - \u52a8\u91cf\u80cc\u79bb'}
              onChange={(showOscHighDivergencePoint) => patch({ showOscHighDivergencePoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(oscHighDivergenceVdoThreshold) => patch({ oscHighDivergenceVdoThreshold })}
            threshold={settings.oscHighDivergenceVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendDownReturnPoint}
              label={'\u4e0b\u964d\u8d8b\u52bf-\u56de\u5f52\u70b9'}
              onChange={(showTrendDownReturnPoint) => patch({ showTrendDownReturnPoint })}
            />
          </div>
          <MmfMorganOnlyRow
            max={1}
            min={0}
            onChange={(trendDownReturnMorganRatio) => patch({ trendDownReturnMorganRatio })}
            onVdoThresholdChange={(trendDownReturnVdoThreshold) => patch({ trendDownReturnVdoThreshold })}
            value={settings.trendDownReturnMorganRatio}
            vdoThreshold={settings.trendDownReturnVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendUpReturnPoint}
              label={'\u4e0a\u5347\u8d8b\u52bf-\u56de\u5f52\u70b9'}
              onChange={(showTrendUpReturnPoint) => patch({ showTrendUpReturnPoint })}
            />
          </div>
          <MmfMorganOnlyRow
            max={1}
            min={0}
            onChange={(trendUpReturnMorganRatio) => patch({ trendUpReturnMorganRatio })}
            onVdoThresholdChange={(trendUpReturnVdoThreshold) => patch({ trendUpReturnVdoThreshold })}
            value={settings.trendUpReturnMorganRatio}
            vdoThreshold={settings.trendUpReturnVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendDownDivergencePoint}
              label={'\u4e0b\u964d\u8d8b\u52bf - \u52a8\u91cf\u80cc\u79bb'}
              onChange={(showTrendDownDivergencePoint) => patch({ showTrendDownDivergencePoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(trendDownDivergenceVdoThreshold) => patch({ trendDownDivergenceVdoThreshold })}
            threshold={settings.trendDownDivergenceVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendUpDivergencePoint}
              label={'\u4e0a\u5347\u8d8b\u52bf - \u52a8\u91cf\u80cc\u79bb'}
              onChange={(showTrendUpDivergencePoint) => patch({ showTrendUpDivergencePoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(trendUpDivergenceVdoThreshold) => patch({ trendUpDivergenceVdoThreshold })}
            threshold={settings.trendUpDivergenceVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showBottomDivergencePoint}
              label={'\u5e95\u80cc\u79bb'}
              onChange={(showBottomDivergencePoint) => patch({ showBottomDivergencePoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(bottomDivergenceVdoThreshold) => patch({ bottomDivergenceVdoThreshold })}
            threshold={settings.bottomDivergenceVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTopDivergencePoint}
              label={'\u9876\u80cc\u79bb'}
              onChange={(showTopDivergencePoint) => patch({ showTopDivergencePoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(topDivergenceVdoThreshold) => patch({ topDivergenceVdoThreshold })}
            threshold={settings.topDivergenceVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showUpBreakConfirmPoint}
              label={'\u5411\u4e0a\u7a81\u7834\u786e\u8ba4\u70b9'}
              onChange={(showUpBreakConfirmPoint) => patch({ showUpBreakConfirmPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(upBreakConfirmVdoThreshold) => patch({ upBreakConfirmVdoThreshold })}
            threshold={settings.upBreakConfirmVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showDownBreakConfirmPoint}
              label={'\u5411\u4e0b\u7a81\u7834\u786e\u8ba4\u70b9'}
              onChange={(showDownBreakConfirmPoint) => patch({ showDownBreakConfirmPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(downBreakConfirmVdoThreshold) => patch({ downBreakConfirmVdoThreshold })}
            threshold={settings.downBreakConfirmVdoThreshold}
          />
        </div>
      </section>
    </div>
  )
}

export function MmfStylePanel({
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
          color={settings.lowColor}
          label={'\u4f4e\u70b9'}
          onColorChange={(lowColor) => patch({ lowColor })}
          onSizeChange={(lowSize) => patch({ lowSize })}
          onSymbolChange={(lowSymbol) => patch({ lowSymbol })}
          size={settings.lowSize}
          symbol={settings.lowSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.lowPositionHighColor}
          label={'\u4f4e\u4f4d\u9ad8\u70b9'}
          onColorChange={(lowPositionHighColor) => patch({ lowPositionHighColor })}
          onSizeChange={(lowPositionHighSize) => patch({ lowPositionHighSize })}
          onSymbolChange={(lowPositionHighSymbol) => patch({ lowPositionHighSymbol })}
          size={settings.lowPositionHighSize}
          symbol={settings.lowPositionHighSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.highPositionLowColor}
          label={'\u9ad8\u4f4d\u4f4e\u70b9'}
          onColorChange={(highPositionLowColor) => patch({ highPositionLowColor })}
          onSizeChange={(highPositionLowSize) => patch({ highPositionLowSize })}
          onSymbolChange={(highPositionLowSymbol) => patch({ highPositionLowSymbol })}
          size={settings.highPositionLowSize}
          symbol={settings.highPositionLowSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.upBreakColor}
          label={'\u5411\u4e0a\u65b9\u5411\u70b9'}
          onColorChange={(upBreakColor) => patch({ upBreakColor })}
          onSizeChange={(upBreakSize) => patch({ upBreakSize })}
          onSymbolChange={(upBreakSymbol) => patch({ upBreakSymbol })}
          size={settings.upBreakSize}
          symbol={settings.upBreakSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.downBreakColor}
          label={'\u5411\u4e0b\u65b9\u5411\u70b9'}
          onColorChange={(downBreakColor) => patch({ downBreakColor })}
          onSizeChange={(downBreakSize) => patch({ downBreakSize })}
          onSymbolChange={(downBreakSymbol) => patch({ downBreakSymbol })}
          size={settings.downBreakSize}
          symbol={settings.downBreakSymbol}
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
          color={settings.supportColor}
          label={'\u652f\u6491\u4f4d'}
          onColorChange={(supportColor) => patch({ supportColor })}
          onSizeChange={(supportSize) => patch({ supportSize })}
          onSymbolChange={(supportSymbol) => patch({ supportSymbol })}
          size={settings.supportSize}
          symbol={settings.supportSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendDownColor}
          label={'\u8d8b\u52bf\u4e0b\u964d\u70b9'}
          onColorChange={(trendDownColor) => patch({ trendDownColor })}
          onSizeChange={(trendDownSize) => patch({ trendDownSize })}
          onSymbolChange={(trendDownSymbol) => patch({ trendDownSymbol })}
          size={settings.trendDownSize}
          symbol={settings.trendDownSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendUpColor}
          label={'\u8d8b\u52bf\u4e0a\u5347\u70b9'}
          onColorChange={(trendUpColor) => patch({ trendUpColor })}
          onSizeChange={(trendUpSize) => patch({ trendUpSize })}
          onSymbolChange={(trendUpSymbol) => patch({ trendUpSymbol })}
          size={settings.trendUpSize}
          symbol={settings.trendUpSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.reboundColor}
          label={'\u53cd\u5f39\u70b9'}
          onColorChange={(reboundColor) => patch({ reboundColor })}
          onSizeChange={(reboundSize) => patch({ reboundSize })}
          onSymbolChange={(reboundSymbol) => patch({ reboundSymbol })}
          size={settings.reboundSize}
          symbol={settings.reboundSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.pullbackColor}
          label={'\u56de\u64a4\u70b9'}
          onColorChange={(pullbackColor) => patch({ pullbackColor })}
          onSizeChange={(pullbackSize) => patch({ pullbackSize })}
          onSymbolChange={(pullbackSymbol) => patch({ pullbackSymbol })}
          size={settings.pullbackSize}
          symbol={settings.pullbackSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.oscLowDivergenceColor}
          label={'\u9707\u8361\u4f4e\u70b9 - \u52a8\u91cf\u80cc\u79bb'}
          onColorChange={(oscLowDivergenceColor) => patch({ oscLowDivergenceColor })}
          onSizeChange={(oscLowDivergenceSize) => patch({ oscLowDivergenceSize })}
          onSymbolChange={(oscLowDivergenceSymbol) => patch({ oscLowDivergenceSymbol })}
          size={settings.oscLowDivergenceSize}
          symbol={settings.oscLowDivergenceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.oscHighDivergenceColor}
          label={'\u9707\u8361\u9ad8\u70b9 - \u52a8\u91cf\u80cc\u79bb'}
          onColorChange={(oscHighDivergenceColor) => patch({ oscHighDivergenceColor })}
          onSizeChange={(oscHighDivergenceSize) => patch({ oscHighDivergenceSize })}
          onSymbolChange={(oscHighDivergenceSymbol) => patch({ oscHighDivergenceSymbol })}
          size={settings.oscHighDivergenceSize}
          symbol={settings.oscHighDivergenceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendDownReturnColor}
          label={'\u4e0b\u964d\u8d8b\u52bf-\u56de\u5f52\u70b9'}
          onColorChange={(trendDownReturnColor) => patch({ trendDownReturnColor })}
          onSizeChange={(trendDownReturnSize) => patch({ trendDownReturnSize })}
          onSymbolChange={(trendDownReturnSymbol) => patch({ trendDownReturnSymbol })}
          size={settings.trendDownReturnSize}
          symbol={settings.trendDownReturnSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendUpReturnColor}
          label={'\u4e0a\u5347\u8d8b\u52bf-\u56de\u5f52\u70b9'}
          onColorChange={(trendUpReturnColor) => patch({ trendUpReturnColor })}
          onSizeChange={(trendUpReturnSize) => patch({ trendUpReturnSize })}
          onSymbolChange={(trendUpReturnSymbol) => patch({ trendUpReturnSymbol })}
          size={settings.trendUpReturnSize}
          symbol={settings.trendUpReturnSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendDownDivergenceColor}
          label={'\u4e0b\u964d\u8d8b\u52bf - \u52a8\u91cf\u80cc\u79bb'}
          onColorChange={(trendDownDivergenceColor) => patch({ trendDownDivergenceColor })}
          onSizeChange={(trendDownDivergenceSize) => patch({ trendDownDivergenceSize })}
          onSymbolChange={(trendDownDivergenceSymbol) => patch({ trendDownDivergenceSymbol })}
          size={settings.trendDownDivergenceSize}
          symbol={settings.trendDownDivergenceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendUpDivergenceColor}
          label={'\u4e0a\u5347\u8d8b\u52bf - \u52a8\u91cf\u80cc\u79bb'}
          onColorChange={(trendUpDivergenceColor) => patch({ trendUpDivergenceColor })}
          onSizeChange={(trendUpDivergenceSize) => patch({ trendUpDivergenceSize })}
          onSymbolChange={(trendUpDivergenceSymbol) => patch({ trendUpDivergenceSymbol })}
          size={settings.trendUpDivergenceSize}
          symbol={settings.trendUpDivergenceSymbol}
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
          color={settings.topDivergenceColor}
          label={'\u9876\u80cc\u79bb'}
          onColorChange={(topDivergenceColor) => patch({ topDivergenceColor })}
          onSizeChange={(topDivergenceSize) => patch({ topDivergenceSize })}
          onSymbolChange={(topDivergenceSymbol) => patch({ topDivergenceSymbol })}
          size={settings.topDivergenceSize}
          symbol={settings.topDivergenceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.upBreakConfirmColor}
          label={'\u5411\u4e0a\u7a81\u7834\u786e\u8ba4\u70b9'}
          onColorChange={(upBreakConfirmColor) => patch({ upBreakConfirmColor })}
          onSizeChange={(upBreakConfirmSize) => patch({ upBreakConfirmSize })}
          onSymbolChange={(upBreakConfirmSymbol) => patch({ upBreakConfirmSymbol })}
          size={settings.upBreakConfirmSize}
          symbol={settings.upBreakConfirmSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.downBreakConfirmColor}
          label={'\u5411\u4e0b\u7a81\u7834\u786e\u8ba4\u70b9'}
          onColorChange={(downBreakConfirmColor) => patch({ downBreakConfirmColor })}
          onSizeChange={(downBreakConfirmSize) => patch({ downBreakConfirmSize })}
          onSymbolChange={(downBreakConfirmSymbol) => patch({ downBreakConfirmSymbol })}
          size={settings.downBreakConfirmSize}
          symbol={settings.downBreakConfirmSymbol}
        />
      </section>
    </div>
  )
}

