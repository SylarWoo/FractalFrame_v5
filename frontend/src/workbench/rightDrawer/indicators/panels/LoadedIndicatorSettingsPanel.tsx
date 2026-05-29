import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { MorganRangeSegment } from '../../../chart/morganRangeModel'
import type { MmfV2MomentumStats } from '../../../chart/mmfV2MomentumStats'
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
  MmfInputPanel,
  MmfStylePanel,
  MmfV2InputPanel,
  MmfV2StrategyPanel,
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
  VolInputPanel,
  VolStylePanel,
  VwapInputPanel,
  VwapStylePanel,
} from './indicatorPanelComponents'

export function LoadedIndicatorSettingsPanel({
  dpoSettings,
  macdSettings,
  maSettings,
  mmfV2MomentumCrosshairIndex,
  mmfSettings,
  mmfV2MomentumStats,
  mrSettings,
  morganRangeSegment,
  onDpoSettingsChange,
  onMacdSettingsChange,
  onMaSettingsChange,
  onMmfSettingsChange,
  onMmfV2SettingsChange,
  onMrSettingsChange,
  onSettingsChange,
  onSqzmomSettingsChange,
  onStochSettingsChange,
  onTsiSettingsChange,
  onVdoSettingsChange,
  onViSettingsChange,
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
  volSettings,
  vwapSettings,
}: {
  dpoSettings: DpoIndicatorSettings
  macdSettings: MacdIndicatorSettings
  maSettings: MaIndicatorSettings
  mmfV2MomentumCrosshairIndex?: number | null
  mmfSettings: MmfIndicatorSettings
  mmfV2MomentumStats?: MmfV2MomentumStats | null
  mrSettings: MrIndicatorSettings
  morganRangeSegment?: MorganRangeSegment | null
  onDpoSettingsChange: (settings: DpoIndicatorSettings) => void
  onMacdSettingsChange: (settings: MacdIndicatorSettings) => void
  onMaSettingsChange: (settings: MaIndicatorSettings) => void
  onMmfSettingsChange: (settings: MmfIndicatorSettings) => void
  onMmfV2SettingsChange: (settings: MmfIndicatorSettings) => void
  onMrSettingsChange: (settings: MrIndicatorSettings) => void
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  onSqzmomSettingsChange: (settings: SqzmomIndicatorSettings) => void
  onStochSettingsChange: (settings: StochIndicatorSettings) => void
  onTsiSettingsChange: (settings: TsiIndicatorSettings) => void
  onVdoSettingsChange: (settings: VdoIndicatorSettings) => void
  onViSettingsChange: (settings: ViIndicatorSettings) => void
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
    MR: {
      input: <MrInputPanelV3 segment={morganRangeSegment} onSettingsChange={onMrSettingsChange} settings={mrSettings} />,
      style: <MrStylePanelV3 onSettingsChange={onMrSettingsChange} settings={mrSettings} />,
    },
    MMF: {
      input: <MmfInputPanel settings={mmfSettings} onSettingsChange={onMmfSettingsChange} />,
      style: <MmfStylePanel settings={mmfSettings} onSettingsChange={onMmfSettingsChange} />,
    },
    MMF_V2: {
      input: <MmfV2InputPanel settings={mmfSettings} onSettingsChange={onMmfV2SettingsChange} />,
      style: <MmfV2StylePanel settings={mmfSettings} onSettingsChange={onMmfV2SettingsChange} />,
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
        selectedKey === 'MMF_V2' ? (
          <MmfV2VisibilityMomentumPanel
            momentumCrosshairIndex={mmfV2MomentumCrosshairIndex}
            momentumStats={mmfV2MomentumStats}
            onSettingsChange={onMmfV2SettingsChange}
            settings={mmfSettings}
            storageKey={`indicator:${selectedKey || 'default'}`}
          />
        ) : (
          <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">
            <VisibilityRangePanel storageKey={`indicator:${selectedKey || 'default'}`} />
          </div>
        )
      ) : null}
    </>
  )
}

function MmfV2VisibilityMomentumPanel({
  momentumCrosshairIndex,
  momentumStats,
  onSettingsChange,
  settings,
  storageKey,
}: {
  momentumCrosshairIndex?: number | null
  momentumStats?: MmfV2MomentumStats | null
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
  storageKey: string
}) {
  const [topHeight, setTopHeight] = useState(42)

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget
    target.setPointerCapture(pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(Math.max(0, Math.min(190, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <div
      className="ff-indicators-input-panel-v1__tab-panel ff-indicators-mmf-v2-visibility-momentum-panel"
      role="tabpanel"
      style={{ ['--ff-mmf-v2-visibility-height' as string]: `${topHeight}px` }}
    >
      <div className="ff-indicators-mmf-v2-visibility-momentum-panel__visibility">
        <VisibilityRangePanel storageKey={storageKey} />
      </div>
      <button
        aria-label="Resize MMF V2 momentum panel"
        className="ff-indicators-mmf-v2-visibility-momentum-panel__handle"
        onPointerDown={handlePointerDown}
        title="\u4e0a\u4e0b\u62d6\u52a8\u8c03\u6574\u53ef\u89c1\u8303\u56f4"
        type="button"
      />
      <MmfV2StrategyPanel
        momentumCrosshairIndex={momentumCrosshairIndex}
        momentumStats={momentumStats}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />
    </div>
  )
}
