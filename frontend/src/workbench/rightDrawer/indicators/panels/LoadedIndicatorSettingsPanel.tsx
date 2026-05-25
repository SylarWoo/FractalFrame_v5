import { VisibilityRangePanel } from '../../../visibilityRange/VisibilityRangePanel'
import type {
  DpoIndicatorSettings,
  IndicatorSettingsTab,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  RsiIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  VolIndicatorSettings,
  VwapIndicatorSettings,
} from '../../indicatorPersistence'
import {
  MacdInputPanel,
  MacdStylePanel,
  MaInputPanel,
  MaStylePanel,
  DpoInputPanel,
  DpoStylePanel,
  MrInputPanel,
  MrStylePanel,
  RsiInputPanel,
  RsiStylePanel,
  StochInputPanel,
  StochStylePanel,
  TsiInputPanel,
  TsiStylePanel,
  VdoInputPanel,
  VdoStylePanel,
  ViInputPanel,
  ViStylePanel,
  VolInputPanel,
  VolStylePanel,
  VwapInputPanel,
  VwapStylePanel,
} from './indicatorPanelComponents'

export function LoadedIndicatorSettingsPanel({
  dpoSettings,
  macdSettings,
  maSettings,
  onDpoSettingsChange,
  onMacdSettingsChange,
  onMaSettingsChange,
  onSettingsChange,
  onStochSettingsChange,
  onTsiSettingsChange,
  onVdoSettingsChange,
  onViSettingsChange,
  onVolSettingsChange,
  onVwapSettingsChange,
  settingsTab,
  selectedKey,
  settings,
  stochSettings,
  tsiSettings,
  vdoSettings,
  viSettings,
  volSettings,
  vwapSettings,
}: {
  dpoSettings: DpoIndicatorSettings
  macdSettings: MacdIndicatorSettings
  maSettings: MaIndicatorSettings
  onDpoSettingsChange: (settings: DpoIndicatorSettings) => void
  onMacdSettingsChange: (settings: MacdIndicatorSettings) => void
  onMaSettingsChange: (settings: MaIndicatorSettings) => void
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  onStochSettingsChange: (settings: StochIndicatorSettings) => void
  onTsiSettingsChange: (settings: TsiIndicatorSettings) => void
  onVdoSettingsChange: (settings: VdoIndicatorSettings) => void
  onViSettingsChange: (settings: ViIndicatorSettings) => void
  onVolSettingsChange: (settings: VolIndicatorSettings) => void
  onVwapSettingsChange: (settings: VwapIndicatorSettings) => void
  settingsTab: IndicatorSettingsTab
  selectedKey: string
  settings: RsiIndicatorSettings
  stochSettings: StochIndicatorSettings
  tsiSettings: TsiIndicatorSettings
  vdoSettings: VdoIndicatorSettings
  viSettings: ViIndicatorSettings
  volSettings: VolIndicatorSettings
  vwapSettings: VwapIndicatorSettings
}) {
  return (
    <>
      {selectedKey === 'RSI' && settingsTab === 'input' ? <RsiInputPanel onSettingsChange={onSettingsChange} settings={settings} /> : null}
      {selectedKey === 'RSI' && settingsTab === 'style' ? <RsiStylePanel onSettingsChange={onSettingsChange} settings={settings} /> : null}
      {selectedKey === 'Stoch' && settingsTab === 'input' ? <StochInputPanel onSettingsChange={onStochSettingsChange} settings={stochSettings} /> : null}
      {selectedKey === 'Stoch' && settingsTab === 'style' ? <StochStylePanel onSettingsChange={onStochSettingsChange} settings={stochSettings} /> : null}
      {selectedKey === 'MACD' && settingsTab === 'input' ? <MacdInputPanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} /> : null}
      {selectedKey === 'MACD' && settingsTab === 'style' ? <MacdStylePanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} /> : null}
      {selectedKey === 'DPO' && settingsTab === 'input' ? <DpoInputPanel onSettingsChange={onDpoSettingsChange} settings={dpoSettings} /> : null}
      {selectedKey === 'DPO' && settingsTab === 'style' ? <DpoStylePanel onSettingsChange={onDpoSettingsChange} settings={dpoSettings} /> : null}
      {selectedKey === 'TSI' && settingsTab === 'input' ? <TsiInputPanel onSettingsChange={onTsiSettingsChange} settings={tsiSettings} /> : null}
      {selectedKey === 'TSI' && settingsTab === 'style' ? <TsiStylePanel onSettingsChange={onTsiSettingsChange} settings={tsiSettings} /> : null}
      {selectedKey === 'VDO' && settingsTab === 'input' ? <VdoInputPanel onSettingsChange={onVdoSettingsChange} settings={vdoSettings} /> : null}
      {selectedKey === 'VDO' && settingsTab === 'style' ? <VdoStylePanel onSettingsChange={onVdoSettingsChange} settings={vdoSettings} /> : null}
      {selectedKey === 'VI' && settingsTab === 'input' ? <ViInputPanel onSettingsChange={onViSettingsChange} settings={viSettings} /> : null}
      {selectedKey === 'VI' && settingsTab === 'style' ? <ViStylePanel onSettingsChange={onViSettingsChange} settings={viSettings} /> : null}
      {selectedKey === 'MA' && settingsTab === 'input' ? <MaInputPanel onSettingsChange={onMaSettingsChange} settings={maSettings} /> : null}
      {selectedKey === 'MA' && settingsTab === 'style' ? <MaStylePanel onSettingsChange={onMaSettingsChange} settings={maSettings} /> : null}
      {selectedKey === 'MR' && settingsTab === 'input' ? <MrInputPanel /> : null}
      {selectedKey === 'MR' && settingsTab === 'style' ? <MrStylePanel /> : null}
      {selectedKey === 'VWAP' && settingsTab === 'input' ? <VwapInputPanel onSettingsChange={onVwapSettingsChange} settings={vwapSettings} /> : null}
      {selectedKey === 'VWAP' && settingsTab === 'style' ? <VwapStylePanel onSettingsChange={onVwapSettingsChange} settings={vwapSettings} /> : null}
      {selectedKey === 'Vol' && settingsTab === 'input' ? <VolInputPanel onSettingsChange={onVolSettingsChange} settings={volSettings} /> : null}
      {selectedKey === 'Vol' && settingsTab === 'style' ? <VolStylePanel onSettingsChange={onVolSettingsChange} settings={volSettings} /> : null}
      {settingsTab === 'visibility' ? (
        <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">
          <VisibilityRangePanel storageKey={`indicator:${selectedKey || 'default'}`} />
        </div>
      ) : null}
    </>
  )
}
