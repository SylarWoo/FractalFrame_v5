import { useEffect, useRef, useState } from 'react'
import type { MmfStochH2IndicatorSettings, MmfStochH2PassthroughPeriod } from '../../indicatorSettingsSchema'
import { mmfTradeArrowSymbolOptions } from '../../stickerSymbols'
import { CheckControl } from './IndicatorSettingControls'
import { MmfMarkerStyleRow } from './MmfSettingsControls'

const passthroughOptions: Array<{ label: string; value: MmfStochH2PassthroughPeriod }> = [
  { label: 'M5', value: 'M5' },
  { label: 'M30', value: 'M30' },
  { label: 'H2', value: 'H2' },
]

function updateMmfStochH2Settings(
  settings: MmfStochH2IndicatorSettings,
  patch: Partial<MmfStochH2IndicatorSettings>,
): MmfStochH2IndicatorSettings {
  return { ...settings, ...patch }
}

function MmfStochH2PassthroughSelect({
  onChange,
  value,
}: {
  onChange: (value: MmfStochH2PassthroughPeriod[]) => void
  value: MmfStochH2PassthroughPeriod[]
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = new Set(value)
  const label = passthroughOptions
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
    .join(', ') || '隐藏'

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [open])

  return (
    <div className="ff-settings-multicheck-select ff-indicators-mmf-stoch-h2-panel__passthrough-select" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="透传周期"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">⌄</span>
      </button>
      {open ? (
        <div className="ff-settings-multicheck-select__menu" role="menu">
          {passthroughOptions.map((option) => {
            const active = selected.has(option.value)
            return (
              <button
                aria-checked={active}
                className="ff-settings-multicheck-select__option"
                key={option.value}
                onClick={() => {
                  const next = new Set(selected)
                  if (next.has(option.value)) next.delete(option.value)
                  else next.add(option.value)
                  onChange(passthroughOptions.filter((item) => next.has(item.value)).map((item) => item.value))
                }}
                role="menuitemcheckbox"
                type="button"
              >
                <span className="ff-settings-multicheck-select__box" data-active={active}>{active ? '✓' : ''}</span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function MmfStochH2InputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmfStochH2IndicatorSettings) => void
  settings: MmfStochH2IndicatorSettings
}) {
  const patch = (next: Partial<MmfStochH2IndicatorSettings>) => onSettingsChange(updateMmfStochH2Settings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mmf-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section ff-indicators-mmf-panel-v1__scroll-section">
        <div className="ff-indicators-mmf-v2-panel__signal-block">
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showEnterOverbought} label="进入超买" onChange={(showEnterOverbought) => patch({ showEnterOverbought })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showCloseOverbought} label="关闭超买" onChange={(showCloseOverbought) => patch({ showCloseOverbought })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showEnterOversold} label="进入超卖" onChange={(showEnterOversold) => patch({ showEnterOversold })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.showCloseOversold} label="关闭超卖" onChange={(showCloseOversold) => patch({ showCloseOversold })} />
          </div>
          <div className="ff-indicators-mmf-v2-panel__check-row">
            <CheckControl checked={settings.passthroughVisible} label="透传" onChange={(passthroughVisible) => patch({ passthroughVisible })} />
          </div>
          <div className="ff-indicators-mmf-stoch-h2-panel__passthrough-row">
            <MmfStochH2PassthroughSelect
              onChange={(passthroughPeriods) => patch({ passthroughPeriods })}
              value={settings.passthroughPeriods}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

export function MmfStochH2StylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmfStochH2IndicatorSettings) => void
  settings: MmfStochH2IndicatorSettings
}) {
  const patch = (next: Partial<MmfStochH2IndicatorSettings>) => onSettingsChange(updateMmfStochH2Settings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-mmf-style-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <MmfMarkerStyleRow
          color={settings.enterOverboughtColor}
          label="进入超买"
          onColorChange={(enterOverboughtColor) => patch({ enterOverboughtColor })}
          onSizeChange={(enterOverboughtSize) => patch({ enterOverboughtSize })}
          onSymbolChange={(enterOverboughtSymbol) => patch({ enterOverboughtSymbol })}
          options={mmfTradeArrowSymbolOptions}
          size={settings.enterOverboughtSize}
          symbol={settings.enterOverboughtSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.closeOverboughtColor}
          label="关闭超买"
          onColorChange={(closeOverboughtColor) => patch({ closeOverboughtColor })}
          onSizeChange={(closeOverboughtSize) => patch({ closeOverboughtSize })}
          onSymbolChange={(closeOverboughtSymbol) => patch({ closeOverboughtSymbol })}
          options={mmfTradeArrowSymbolOptions}
          size={settings.closeOverboughtSize}
          symbol={settings.closeOverboughtSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.enterOversoldColor}
          label="进入超卖"
          onColorChange={(enterOversoldColor) => patch({ enterOversoldColor })}
          onSizeChange={(enterOversoldSize) => patch({ enterOversoldSize })}
          onSymbolChange={(enterOversoldSymbol) => patch({ enterOversoldSymbol })}
          options={mmfTradeArrowSymbolOptions}
          size={settings.enterOversoldSize}
          symbol={settings.enterOversoldSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.closeOversoldColor}
          label="关闭超卖"
          onColorChange={(closeOversoldColor) => patch({ closeOversoldColor })}
          onSizeChange={(closeOversoldSize) => patch({ closeOversoldSize })}
          onSymbolChange={(closeOversoldSymbol) => patch({ closeOversoldSymbol })}
          options={mmfTradeArrowSymbolOptions}
          size={settings.closeOversoldSize}
          symbol={settings.closeOversoldSymbol}
        />
      </section>
    </div>
  )
}
