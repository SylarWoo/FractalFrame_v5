import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { IndicatorSettingsShell } from './IndicatorSettingsShell'
import { IndicatorsTable } from './IndicatorsTable'
import { indicatorRows, isSupportedChartIndicator } from './indicatorDefinitions'
import { LoadedIndicatorSettingsPanel } from './indicatorSettingsPanels'
import type { IndicatorsController } from '../indicators/useIndicatorsController'
import type { MorganRangeSegment } from '../chart/morganRangeModel'
import './IndicatorsDrawer.css'

type IndicatorsDrawerProps = {
  indicatorShortcutKeys: string[]
  indicatorsController: IndicatorsController
  loadedIndicatorKeys: string[]
  morganRangeSegment?: MorganRangeSegment | null
  onIndicatorShortcutKeysChange: (keys: string[]) => void
}

export function IndicatorsDrawer({ indicatorShortcutKeys, indicatorsController, loadedIndicatorKeys, morganRangeSegment, onIndicatorShortcutKeysChange }: IndicatorsDrawerProps) {
  const [topHeight, setTopHeight] = useState(254)
  const loadedKeySet = new Set(loadedIndicatorKeys)
  const selectedKey = indicatorsController.selectedKey
  const settingsTab = indicatorsController.settingsTab
  const selected = indicatorRows.find((row) => row.key === selectedKey) ?? indicatorRows[0]
  const selectedLoaded = loadedKeySet.has(selected.key)

  function handleLoadSelected() {
    if (!isSupportedChartIndicator(selected.key)) return
    indicatorsController.loadIndicator(selected.key)
  }

  function handleUnloadSelected() {
    if (!isSupportedChartIndicator(selected.key)) return
    indicatorsController.unloadIndicator(selected.key)
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
          onSelect={indicatorsController.setSelectedKey}
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
            persistenceEnabled={indicatorsController.persistenceEnabled}
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
              mmfSettings={indicatorsController.settings.mmf}
              morganRangeSegment={morganRangeSegment}
              mrSettings={indicatorsController.settings.mr}
              onDpoSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('DPO', settings)}
              onMacdSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MACD', settings)}
              onMaSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MA', settings)}
              onMmfSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MMF', settings)}
              onMmfV2SettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MMF_V2', settings)}
              onMrSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('MR', settings)}
              onSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('RSI', settings)}
              onSqzmomSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('SQZMOM', settings)}
              onStochSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('Stoch', settings)}
              onTsiSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('TSI', settings)}
              onVdoSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('VDO', settings)}
              onViSettingsChange={(settings) => indicatorsController.updateIndicatorSettings('VI', settings)}
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
              volSettings={indicatorsController.settings.vol}
              vwapSettings={indicatorsController.settings.vwap}
            />
          </IndicatorSettingsShell>
        </div>
      </div>
    </section>
  )
}
