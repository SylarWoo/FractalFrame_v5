import type { ReactNode } from 'react'
import { VisibilityRangePanel } from '../../../visibilityRange/VisibilityRangePanel'
import type { SupportedChartIndicator } from '../../indicatorDefinitions'
import type {
  DpoIndicatorSettings,
  IndicatorSettingsTab,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  MrIndicatorSettings,
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
  MrInputPanelV3,
  MrStylePanelV3,
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
  mrSettings,
  onDpoSettingsChange,
  onMacdSettingsChange,
  onMaSettingsChange,
  onMrSettingsChange,
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
  mrSettings: MrIndicatorSettings
  onDpoSettingsChange: (settings: DpoIndicatorSettings) => void
  onMacdSettingsChange: (settings: MacdIndicatorSettings) => void
  onMaSettingsChange: (settings: MaIndicatorSettings) => void
  onMrSettingsChange: (settings: MrIndicatorSettings) => void
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
  const panelRegistry: Partial<Record<SupportedChartIndicator, Record<Exclude<IndicatorSettingsTab, 'visibility'>, ReactNode>>> = {
    DPO: {
      input: <DpoInputPanel onSettingsChange={onDpoSettingsChange} settings={dpoSettings} />,
      style: <DpoStylePanel onSettingsChange={onDpoSettingsChange} settings={dpoSettings} />,
    },
    MA: {
      input: <MaInputPanel onSettingsChange={onMaSettingsChange} settings={maSettings} />,
      style: <MaStylePanel onSettingsChange={onMaSettingsChange} settings={maSettings} />,
    },
    MACD: {
      input: <MacdInputPanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} />,
      style: <MacdStylePanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} />,
    },
    MR: {
      input: <MrInputPanelV3 onSettingsChange={onMrSettingsChange} settings={mrSettings} />,
      style: <MrStylePanelV3 onSettingsChange={onMrSettingsChange} settings={mrSettings} />,
    },
    RSI: {
      input: <RsiInputPanel onSettingsChange={onSettingsChange} settings={settings} />,
      style: <RsiStylePanel onSettingsChange={onSettingsChange} settings={settings} />,
    },
    Stoch: {
      input: <StochInputPanel onSettingsChange={onStochSettingsChange} settings={stochSettings} />,
      style: <StochStylePanel onSettingsChange={onStochSettingsChange} settings={stochSettings} />,
    },
    TSI: {
      input: <TsiInputPanel onSettingsChange={onTsiSettingsChange} settings={tsiSettings} />,
      style: <TsiStylePanel onSettingsChange={onTsiSettingsChange} settings={tsiSettings} />,
    },
    VDO: {
      input: <VdoInputPanel onSettingsChange={onVdoSettingsChange} settings={vdoSettings} />,
      style: <VdoStylePanel onSettingsChange={onVdoSettingsChange} settings={vdoSettings} />,
    },
    VI: {
      input: <ViInputPanel onSettingsChange={onViSettingsChange} settings={viSettings} />,
      style: <ViStylePanel onSettingsChange={onViSettingsChange} settings={viSettings} />,
    },
    VWAP: {
      input: <VwapInputPanel onSettingsChange={onVwapSettingsChange} settings={vwapSettings} />,
      style: <VwapStylePanel onSettingsChange={onVwapSettingsChange} settings={vwapSettings} />,
    },
    Vol: {
      input: <VolInputPanel onSettingsChange={onVolSettingsChange} settings={volSettings} />,
      style: <VolStylePanel onSettingsChange={onVolSettingsChange} settings={volSettings} />,
    },
  }
  const selectedPanel = settingsTab === 'visibility'
    ? null
    : panelRegistry[selectedKey as SupportedChartIndicator]?.[settingsTab]

  return (
    <>
      {selectedPanel ?? null}
      {settingsTab === 'visibility' ? (
        <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">
          <VisibilityRangePanel storageKey={`indicator:${selectedKey || 'default'}`} />
        </div>
      ) : null}
    </>
  )
}
