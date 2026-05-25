import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { IndicatorSettingsShell } from './IndicatorSettingsShell'
import { IndicatorsTable } from './IndicatorsTable'
import { indicatorRows, isSupportedChartIndicator, resolveInitialSelectedKey } from './indicatorDefinitions'
import type { SupportedChartIndicator } from './indicatorDefinitions'
import { LoadedIndicatorSettingsPanel } from './indicatorSettingsPanels'
import {
  clearPersistedIndicatorsState,
  readIndicatorPersistenceEnabled,
  readPersistedIndicatorsState,
  writeIndicatorPersistenceEnabled,
  writePersistedIndicatorsState,
} from './indicatorPersistence'
import type {
  IndicatorSettingsTab,
  DpoIndicatorSettings,
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
} from './indicatorPersistence'
import './IndicatorsDrawer.css'

type IndicatorsDrawerProps = {
  indicatorShortcutKeys: string[]
  loadedIndicatorKeys: string[]
  onIndicatorShortcutKeysChange: (keys: string[]) => void
  onLoadIndicator?: (name: SupportedChartIndicator, settings?: DpoIndicatorSettings | MacdIndicatorSettings | MaIndicatorSettings | MrIndicatorSettings | RsiIndicatorSettings | StochIndicatorSettings | TsiIndicatorSettings | VdoIndicatorSettings | ViIndicatorSettings | VolIndicatorSettings | VwapIndicatorSettings) => void
  onUnloadIndicator?: (name: SupportedChartIndicator) => void
}

export function IndicatorsDrawer({ indicatorShortcutKeys, loadedIndicatorKeys, onIndicatorShortcutKeysChange, onLoadIndicator, onUnloadIndicator }: IndicatorsDrawerProps) {
  const initialPersisted = readPersistedIndicatorsState()
  const [selectedKey, setSelectedKey] = useState(() => resolveInitialSelectedKey(initialPersisted.ui.selectedKey))
  const [settingsTab, setSettingsTab] = useState<IndicatorSettingsTab>(() => initialPersisted.ui.activeTab)
  const [persistenceEnabled, setPersistenceEnabled] = useState(readIndicatorPersistenceEnabled)
  const [dpoSettings, setDpoSettings] = useState<DpoIndicatorSettings>(() => initialPersisted.dpo)
  const [maSettings, setMaSettings] = useState<MaIndicatorSettings>(() => initialPersisted.ma)
  const [mrSettings] = useState<MrIndicatorSettings>(() => initialPersisted.mr)
  const [macdSettings, setMacdSettings] = useState<MacdIndicatorSettings>(() => initialPersisted.macd)
  const [rsiSettings, setRsiSettings] = useState<RsiIndicatorSettings>(() => initialPersisted.rsi)
  const [stochSettings, setStochSettings] = useState<StochIndicatorSettings>(() => initialPersisted.stoch)
  const [tsiSettings, setTsiSettings] = useState<TsiIndicatorSettings>(() => initialPersisted.tsi)
  const [vdoSettings, setVdoSettings] = useState<VdoIndicatorSettings>(() => initialPersisted.vdo)
  const [viSettings, setViSettings] = useState<ViIndicatorSettings>(() => initialPersisted.vi)
  const [vwapSettings, setVwapSettings] = useState<VwapIndicatorSettings>(() => initialPersisted.vwap)
  const [volSettings, setVolSettings] = useState<VolIndicatorSettings>(() => initialPersisted.vol)
  const [topHeight, setTopHeight] = useState(254)
  const loadedKeySet = new Set(loadedIndicatorKeys)
  const selected = indicatorRows.find((row) => row.key === selectedKey) ?? indicatorRows[0]
  const selectedLoaded = loadedKeySet.has(selected.key)

  useEffect(() => {
    if (!persistenceEnabled) return
    writePersistedIndicatorsState({
      loaded: { DPO: loadedKeySet.has('DPO'), MA: loadedKeySet.has('MA'), MACD: loadedKeySet.has('MACD'), MR: loadedKeySet.has('MR'), RSI: loadedKeySet.has('RSI'), Stoch: loadedKeySet.has('Stoch'), TSI: loadedKeySet.has('TSI'), VDO: loadedKeySet.has('VDO'), VI: loadedKeySet.has('VI'), VWAP: loadedKeySet.has('VWAP'), Vol: loadedKeySet.has('Vol') },
      dpo: dpoSettings,
      ma: maSettings,
      macd: macdSettings,
      mr: mrSettings,
      rsi: rsiSettings,
      stoch: stochSettings,
      tsi: tsiSettings,
      vdo: vdoSettings,
      vi: viSettings,
      vwap: vwapSettings,
      vol: volSettings,
      ui: { activeTab: settingsTab, selectedKey },
    })
  }, [dpoSettings, loadedIndicatorKeys, macdSettings, maSettings, mrSettings, persistenceEnabled, rsiSettings, selectedKey, settingsTab, stochSettings, tsiSettings, vdoSettings, viSettings, volSettings, vwapSettings])

  function handleSettingsChange(next: RsiIndicatorSettings) {
    setRsiSettings(next)
    if (loadedKeySet.has('RSI')) onLoadIndicator?.('RSI', next)
  }

  function handleMaSettingsChange(next: MaIndicatorSettings) {
    setMaSettings(next)
    if (loadedKeySet.has('MA')) onLoadIndicator?.('MA', next)
  }

  function handleVolSettingsChange(next: VolIndicatorSettings) {
    setVolSettings(next)
    if (loadedKeySet.has('Vol')) onLoadIndicator?.('Vol', next)
  }

  function handleMacdSettingsChange(next: MacdIndicatorSettings) {
    setMacdSettings(next)
    if (loadedKeySet.has('MACD')) onLoadIndicator?.('MACD', next)
  }

  function handleDpoSettingsChange(next: DpoIndicatorSettings) {
    setDpoSettings(next)
    if (loadedKeySet.has('DPO')) onLoadIndicator?.('DPO', next)
  }

  function handleStochSettingsChange(next: StochIndicatorSettings) {
    setStochSettings(next)
    if (loadedKeySet.has('Stoch')) onLoadIndicator?.('Stoch', next)
  }

  function handleTsiSettingsChange(next: TsiIndicatorSettings) {
    setTsiSettings(next)
    if (loadedKeySet.has('TSI')) onLoadIndicator?.('TSI', next)
  }

  function handleVdoSettingsChange(next: VdoIndicatorSettings) {
    setVdoSettings(next)
    if (loadedKeySet.has('VDO')) onLoadIndicator?.('VDO', next)
  }

  function handleViSettingsChange(next: ViIndicatorSettings) {
    setViSettings(next)
    if (loadedKeySet.has('VI')) onLoadIndicator?.('VI', next)
  }

  function handleVwapSettingsChange(next: VwapIndicatorSettings) {
    setVwapSettings(next)
    if (loadedKeySet.has('VWAP')) onLoadIndicator?.('VWAP', next)
  }

  function getIndicatorSettings(key: SupportedChartIndicator) {
    if (key === 'RSI') return rsiSettings
    if (key === 'Stoch') return stochSettings
    if (key === 'MACD') return macdSettings
    if (key === 'DPO') return dpoSettings
    if (key === 'TSI') return tsiSettings
    if (key === 'VDO') return vdoSettings
    if (key === 'VI') return viSettings
    if (key === 'MA') return maSettings
    if (key === 'MR') return mrSettings
    if (key === 'VWAP') return vwapSettings
    return volSettings
  }

  function loadIndicator(key: SupportedChartIndicator) {
    onLoadIndicator?.(key, getIndicatorSettings(key))
  }

  function unloadIndicator(key: SupportedChartIndicator) {
    onUnloadIndicator?.(key)
  }

  function handlePersistenceChange(enabled: boolean) {
    setPersistenceEnabled(enabled)
    writeIndicatorPersistenceEnabled(enabled)
    if (!enabled) {
      clearPersistedIndicatorsState()
      return
    }
    writePersistedIndicatorsState({
      loaded: { DPO: loadedKeySet.has('DPO'), MA: loadedKeySet.has('MA'), MACD: loadedKeySet.has('MACD'), MR: loadedKeySet.has('MR'), RSI: loadedKeySet.has('RSI'), Stoch: loadedKeySet.has('Stoch'), TSI: loadedKeySet.has('TSI'), VDO: loadedKeySet.has('VDO'), VI: loadedKeySet.has('VI'), VWAP: loadedKeySet.has('VWAP'), Vol: loadedKeySet.has('Vol') },
      dpo: dpoSettings,
      ma: maSettings,
      macd: macdSettings,
      mr: mrSettings,
      rsi: rsiSettings,
      stoch: stochSettings,
      tsi: tsiSettings,
      vdo: vdoSettings,
      vi: viSettings,
      vwap: vwapSettings,
      vol: volSettings,
      ui: { activeTab: settingsTab, selectedKey },
    })
  }

  function handleLoadSelected() {
    if (!isSupportedChartIndicator(selected.key)) return
    loadIndicator(selected.key)
  }

  function handleUnloadSelected() {
    if (!isSupportedChartIndicator(selected.key)) return
    unloadIndicator(selected.key)
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeIndicatorsSplitting = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(Math.max(96, Math.min(420, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-indicators-splitting')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <section className="ff-indicators-drawer" data-right-widget-panel="indicators" data-testid="ff-indicators-drawer-panel">
      <div
        className="ff-indicators-split-v1"
        data-ff-indicators-split-v1
        style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}
      >
        <IndicatorsTable
          indicatorShortcutKeys={indicatorShortcutKeys}
          rows={indicatorRows}
          selectedKey={selectedKey}
          onIndicatorShortcutKeysChange={onIndicatorShortcutKeysChange}
          onSelect={setSelectedKey}
        />
        <button
          aria-label="Resize indicators drawer split"
          className="ff-indicators-split-v1__handle"
          data-ff-indicators-split-handle-v1="true"
          onPointerDown={handleSplitPointerDown}
          title="上下拖动调整窗口大小"
          type="button"
        />
        <div className="ff-indicators-split-v1__bottom" data-ff-indicators-split-bottom-v1>
          <IndicatorSettingsShell
            activeTab={settingsTab}
            loaded={selectedLoaded}
            persistenceEnabled={persistenceEnabled}
            title={`${selected.key} - ${selected.name}`}
            onLoad={handleLoadSelected}
            onPersistenceChange={handlePersistenceChange}
            onTabChange={setSettingsTab}
            onUnload={handleUnloadSelected}
          >
            <LoadedIndicatorSettingsPanel
              dpoSettings={dpoSettings}
              macdSettings={macdSettings}
              maSettings={maSettings}
              onDpoSettingsChange={handleDpoSettingsChange}
              onMacdSettingsChange={handleMacdSettingsChange}
              onMaSettingsChange={handleMaSettingsChange}
              onSettingsChange={handleSettingsChange}
              onStochSettingsChange={handleStochSettingsChange}
              onTsiSettingsChange={handleTsiSettingsChange}
              onVdoSettingsChange={handleVdoSettingsChange}
              onViSettingsChange={handleViSettingsChange}
              onVolSettingsChange={handleVolSettingsChange}
              onVwapSettingsChange={handleVwapSettingsChange}
              settingsTab={settingsTab}
              selectedKey={selected.key}
              settings={rsiSettings}
              stochSettings={stochSettings}
              tsiSettings={tsiSettings}
              vdoSettings={vdoSettings}
              viSettings={viSettings}
              volSettings={volSettings}
              vwapSettings={vwapSettings}
            />
          </IndicatorSettingsShell>
        </div>
      </div>
    </section>
  )
}
