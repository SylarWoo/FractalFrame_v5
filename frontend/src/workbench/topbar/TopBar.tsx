import { useShortcutMenuState } from './useShortcutMenuState'
import type { OpenChartOptions } from './useShortcutMenuState'
import './TopBar.css'

type TopBarProps = {
  onOpenChart?: (options: OpenChartOptions) => void
}

export function TopBar({ onOpenChart }: TopBarProps) {
  const {
    activePeriod,
    enabled,
    open,
    openPeriod,
    periods,
    selectedSymbol,
    selectSymbol,
    setOpen,
    symbols,
  } = useShortcutMenuState({ onOpenChart })

  return (
    <header className="ff-topbar">
      <div className="ff-topbar__brand">FractalFrame</div>

      {enabled && symbols.length > 0 && (
        <div className="ff-shortcut-menu">
          <div className="ff-shortcut-symbol" data-open={open}>
            <button
              aria-expanded={open}
              className="ff-shortcut-symbol__toggle ff-openable-control"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              <span>{selectedSymbol || symbols[0]}</span>
            </button>
            {open && (
              <div className="ff-shortcut-symbol__menu">
                {symbols.map((symbol) => (
                  <button
                    data-active={symbol === selectedSymbol}
                    key={symbol}
                    onClick={() => selectSymbol(symbol)}
                    type="button"
                  >
                    <span>{symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ff-shortcut-periods">
            {periods.map((option) => (
              <button
                data-active={activePeriod === option.period}
                key={option.period}
                onClick={() => openPeriod(option)}
                type="button"
              >
                {option.period}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
