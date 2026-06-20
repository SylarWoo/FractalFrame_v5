import { IndicatorSettingsShell } from './IndicatorSettingsShell'
import { LoadedIndicatorSettingsPanel } from './indicatorSettingsPanels'
import { isSupportedChartIndicator } from './indicatorDefinitions'
import type { IndicatorTableRow } from './IndicatorsTable'
import type { IndicatorsController } from '../indicators/useIndicatorsController'
import type { MorganRangeSegment } from '../chart/morganRangeModel'

const defaultIndicatorSettingsTabs = [
  { id: 'input', label: '\u8f93\u5165' },
  { id: 'style', label: '\u6837\u5f0f' },
  { id: 'visibility', label: '\u53ef\u89c1\u8303\u56f4' },
] as const

export function IndicatorsSettingsPane({
  indicatorsController,
  loaded,
  morganRangeSegment,
  selected,
}: {
  indicatorsController: IndicatorsController
  loaded: boolean
  morganRangeSegment?: MorganRangeSegment | null
  selected: IndicatorTableRow
}) {
  const settingsTab = indicatorsController.settingsTab

  function handleLoadSelected() {
    if (!isSupportedChartIndicator(selected.key)) return
    indicatorsController.loadIndicator(selected.key)
  }

  function handleUnloadSelected() {
    if (!isSupportedChartIndicator(selected.key)) return
    indicatorsController.unloadIndicator(selected.key)
  }

  return (
    <IndicatorSettingsShell
      activeTab={settingsTab}
      loaded={loaded}
      persistenceEnabled={indicatorsController.persistenceEnabled}
      tabs={defaultIndicatorSettingsTabs}
      title={`${selected.key} - ${selected.name}`}
      onLoad={handleLoadSelected}
      onPersistenceChange={indicatorsController.setPersistenceEnabled}
      onTabChange={indicatorsController.setSettingsTab}
      onUnload={handleUnloadSelected}
    >
      <LoadedIndicatorSettingsPanel
        dpoSettings={indicatorsController.settings.dpo}
        macdSettings={indicatorsController.settings.macd}
        maSettings={indicatorsController.settings.ma}
        mmfV3Settings={indicatorsController.settings.mmfV3}
        mmfStochH2Settings={indicatorsController.settings.mmfStochH2}
        mmadSettings={indicatorsController.settings.mmad}
        morganRangeSegment={morganRangeSegment}
        mrH2Settings={indicatorsController.settings.mrH2}
        mrM30Settings={indicatorsController.settings.mrM30}
        mrSettings={indicatorsController.settings.mr}
        onDpoSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('DPO', settings)}
        onMacdSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MACD', settings)}
        onMaSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MA', settings)}
        onMmfV3SettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MMF_V3', settings)}
        onMmfStochH2SettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MMF_STOCH_H2', settings)}
        onMmadSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MMAD', settings)}
        onMrH2SettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MR-H2', settings)}
        onMrM30SettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MR-M30', settings)}
        onMrSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MR-M5', settings)}
        onSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('RSI', settings)}
        onSqzmomSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('SQZMOM', settings)}
        onStochSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('Stoch', settings)}
        onTsiSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('TSI', settings)}
        onVdoSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('VDO', settings)}
        onViSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('VI', settings)}
        onAoSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('AO', settings)}
        onVmiSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('VMI', settings)}
        onVolSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('Vol', settings)}
        onVwapSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('VWAP', settings)}
        settingsTab={settingsTab}
        selectedKey={selected.key}
        settings={indicatorsController.settings.rsi}
        sqzmomSettings={indicatorsController.settings.sqzmom}
        stochSettings={indicatorsController.settings.stoch}
        tsiSettings={indicatorsController.settings.tsi}
        vdoSettings={indicatorsController.settings.vdo}
        viSettings={indicatorsController.settings.vi}
        aoSettings={indicatorsController.settings.ao}
        vmiSettings={indicatorsController.settings.vmi}
        volSettings={indicatorsController.settings.vol}
        vwapSettings={indicatorsController.settings.vwap}
      />
    </IndicatorSettingsShell>
  )
}
