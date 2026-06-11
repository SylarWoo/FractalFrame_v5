import type { ReactNode } from 'react'
import type { MorganRangeSegment } from '../../../chart/morganRangeModel'
import { VisibilityRangePanel } from '../../../visibilityRange/VisibilityRangePanel'
import type { SupportedChartIndicator } from '../../indicatorDefinitions'
import type {
  DpoIndicatorSettings,
  IndicatorSettingsTab,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  MmfIndicatorSettings,
  MrIndicatorSettings,
  RsiIndicatorSettings,
  SqzmomIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  AoIndicatorSettings,
  VmiIndicatorSettings,
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
  MmfV2InputPanel,
  MmfV2StylePanel,
  RsiInputPanel,
  RsiStylePanel,
  SqzmomInputPanel,
  SqzmomStylePanel,
  StochInputPanel,
  StochStylePanel,
  TsiInputPanel,
  TsiStylePanel,
  VdoInputPanel,
  VdoStylePanel,
  ViInputPanel,
  ViStylePanel,
  AoInputPanel,
  AoStylePanel,
  VmiInputPanel,
  VmiStylePanel,
  VolInputPanel,
  VolStylePanel,
  VwapInputPanel,
  VwapStylePanel,
} from './indicatorPanelComponents'

export function LoadedIndicatorSettingsPanel({
  dpoSettings,
  macdSettings,
  maSettings,
  mmfV3Settings,
  mrSettings,
  mrM30Settings,
  mrH2Settings,
  morganRangeSegment,
  onDpoSettingsChange,
  onMacdSettingsChange,
  onMaSettingsChange,
  onMmfV3SettingsChange,
  onMrSettingsChange,
  onMrM30SettingsChange,
  onMrH2SettingsChange,
  onSettingsChange,
  onSqzmomSettingsChange,
  onStochSettingsChange,
  onTsiSettingsChange,
  onVdoSettingsChange,
  onViSettingsChange,
  onAoSettingsChange,
  onVmiSettingsChange,
  onVolSettingsChange,
  onVwapSettingsChange,
  settingsTab,
  selectedKey,
  settings,
  sqzmomSettings,
  stochSettings,
  tsiSettings,
  vdoSettings,
  viSettings,
  aoSettings,
  vmiSettings,
  volSettings,
  vwapSettings,
}: {
  dpoSettings: DpoIndicatorSettings
  macdSettings: MacdIndicatorSettings
  maSettings: MaIndicatorSettings
  mmfV3Settings: MmfIndicatorSettings
  mrSettings: MrIndicatorSettings
  mrM30Settings: MrIndicatorSettings
  mrH2Settings: MrIndicatorSettings
  morganRangeSegment?: MorganRangeSegment | null
  onDpoSettingsChange: (settings: DpoIndicatorSettings) => void
  onMacdSettingsChange: (settings: MacdIndicatorSettings) => void
  onMaSettingsChange: (settings: MaIndicatorSettings) => void
  onMmfV3SettingsChange: (settings: MmfIndicatorSettings) => void
  onMrSettingsChange: (settings: MrIndicatorSettings) => void
  onMrM30SettingsChange: (settings: MrIndicatorSettings) => void
  onMrH2SettingsChange: (settings: MrIndicatorSettings) => void
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  onSqzmomSettingsChange: (settings: SqzmomIndicatorSettings) => void
  onStochSettingsChange: (settings: StochIndicatorSettings) => void
  onTsiSettingsChange: (settings: TsiIndicatorSettings) => void
  onVdoSettingsChange: (settings: VdoIndicatorSettings) => void
  onViSettingsChange: (settings: ViIndicatorSettings) => void
  onAoSettingsChange: (settings: AoIndicatorSettings) => void
  onVmiSettingsChange: (settings: VmiIndicatorSettings) => void
  onVolSettingsChange: (settings: VolIndicatorSettings) => void
  onVwapSettingsChange: (settings: VwapIndicatorSettings) => void
  settingsTab: IndicatorSettingsTab
  selectedKey: string
  settings: RsiIndicatorSettings
  sqzmomSettings: SqzmomIndicatorSettings
  stochSettings: StochIndicatorSettings
  tsiSettings: TsiIndicatorSettings
  vdoSettings: VdoIndicatorSettings
  viSettings: ViIndicatorSettings
  aoSettings: AoIndicatorSettings
  vmiSettings: VmiIndicatorSettings
  volSettings: VolIndicatorSettings
  vwapSettings: VwapIndicatorSettings
}) {
  const panelRegistry: Partial<Record<SupportedChartIndicator, Partial<Record<Extract<IndicatorSettingsTab, 'input' | 'style' | 'strategy'>, ReactNode>>>> = {
    DPO: {
      input: <DpoInputPanel onSettingsChange={onDpoSettingsChange} settings={dpoSettings} />,
      style: <DpoStylePanel onSettingsChange={onDpoSettingsChange} settings={dpoSettings} showBand2Levels />,
    },
    MA: {
      input: <MaInputPanel onSettingsChange={onMaSettingsChange} settings={maSettings} />,
      style: <MaStylePanel onSettingsChange={onMaSettingsChange} settings={maSettings} />,
    },
    MACD: {
      input: <MacdInputPanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} />,
      style: <MacdStylePanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} />,
    },
    'MR-M5': {
      input: <MrInputPanelV3 segment={morganRangeSegment} onSettingsChange={onMrSettingsChange} settings={mrSettings} />,
      style: <MrStylePanelV3 onSettingsChange={onMrSettingsChange} settings={mrSettings} />,
    },
    'MR-M30': {
      input: <MrInputPanelV3 segment={morganRangeSegment} onSettingsChange={onMrM30SettingsChange} settings={mrM30Settings} />,
      style: <MrStylePanelV3 onSettingsChange={onMrM30SettingsChange} settings={mrM30Settings} />,
    },
    'MR-H2': {
      input: <MrInputPanelV3 segment={morganRangeSegment} onSettingsChange={onMrH2SettingsChange} settings={mrH2Settings} />,
      style: <MrStylePanelV3 onSettingsChange={onMrH2SettingsChange} settings={mrH2Settings} />,
    },
    MMF_V3: {
      input: <MmfV2InputPanel settings={mmfV3Settings} onSettingsChange={onMmfV3SettingsChange} />,
      style: <MmfV2StylePanel settings={mmfV3Settings} onSettingsChange={onMmfV3SettingsChange} />,
    },
    RSI: {
      input: <RsiInputPanel onSettingsChange={onSettingsChange} settings={settings} />,
      style: <RsiStylePanel onSettingsChange={onSettingsChange} settings={settings} />,
    },
    SQZMOM: {
      input: <SqzmomInputPanel onSettingsChange={onSqzmomSettingsChange} settings={sqzmomSettings} />,
      style: <SqzmomStylePanel onSettingsChange={onSqzmomSettingsChange} settings={sqzmomSettings} />,
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
    AO: {
      input: <AoInputPanel onSettingsChange={onAoSettingsChange} settings={aoSettings} />,
      style: <AoStylePanel onSettingsChange={onAoSettingsChange} settings={aoSettings} />,
    },
    VMI: {
      input: <VmiInputPanel onSettingsChange={onVmiSettingsChange} settings={vmiSettings} />,
      style: <VmiStylePanel onSettingsChange={onVmiSettingsChange} settings={vmiSettings} />,
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
  const selectedPanel = settingsTab === 'input' || settingsTab === 'style' || settingsTab === 'strategy'
    ? panelRegistry[selectedKey as SupportedChartIndicator]?.[settingsTab]
    : null

  return (
    <>
      {selectedPanel ?? null}
      {settingsTab === 'strategy' && selectedPanel == null ? (
        <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel" />
      ) : null}
      {settingsTab === 'visibility' ? (
        <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">
          <VisibilityRangePanel storageKey={`indicator:${selectedKey || 'default'}`} />
        </div>
      ) : null}
    </>
  )
}
