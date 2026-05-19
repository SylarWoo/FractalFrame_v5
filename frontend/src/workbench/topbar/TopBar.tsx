import { useEffect, useMemo, useState } from 'react'
import './TopBar.css'

type TopBarProps = {
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null }) => void
}

type StoreV5StatusSnapshot = {
  directM1?: {
    rowsCount?: number | null
    trueM1RowsCount?: number | null
  } | null
  rawDirectM1?: {
    rowsCount?: number | null
    rawRowsCount?: number | null
  } | null
  aggregated?: Array<{
    timeframe?: string
    rowsCount?: number | null
  }>
}

type PeriodOption = {
  period: string
  rowsCount?: number | null
}

const watchlistSymbolsStorageKey = 'fractalframe:mt5ImportCenterWatchlistSymbols:v1'
const shortcutMenuEnabledStorageKey = 'fractalframe:mt5ImportCenterShortcutMenuEnabled:v1'
const shortcutMenuPeriodsStorageKey = 'fractalframe:mt5ImportCenterShortcutMenuPeriods:v1'
const storeV5StatusStorageKey = 'fractalframe:mt5ImportCenterStoreV5Status:v1'
const sharedSelectionStorageKey = 'fractalframe:mt5ImportCenterSharedSelection:v1'
const shortcutMenuChangedEvent = 'fractalframe:mt5ImportCenterShortcutMenuChanged'
const watchlistChangedEvent = 'fractalframe:mt5ImportCenterWatchlistChanged'
const storeV5StatusChangedEvent = 'fractalframe:mt5ImportCenterStoreV5StatusChanged'
const sharedSelectionChangedEvent = 'fractalframe:mt5ImportCenterSharedSelectionChanged'
const periodOrder = ['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN1']

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function readWatchlistSymbols() {
  const parsed = readJson<unknown[]>(watchlistSymbolsStorageKey, [])
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

function readShortcutMenuEnabled() {
  try {
    return window.localStorage.getItem(shortcutMenuEnabledStorageKey) === '1'
  } catch {
    return false
  }
}

function resolveDirectM1Rows(status: StoreV5StatusSnapshot | null) {
  return status?.directM1?.rowsCount
    ?? status?.directM1?.trueM1RowsCount
    ?? status?.rawDirectM1?.rowsCount
    ?? status?.rawDirectM1?.rawRowsCount
    ?? null
}

function readShortcutPeriods() {
  const stored = readJson<unknown>(shortcutMenuPeriodsStorageKey, [])
  const rows = Array.isArray(stored)
    ? stored
    : stored && typeof stored === 'object'
      ? Object.values(stored as Record<string, PeriodOption[]>).find((item) => Array.isArray(item)) ?? []
      : []
  return rows
    .filter((row) => typeof row?.period === 'string' && row.period.trim())
    .map((row) => ({
      period: row.period.trim().toUpperCase(),
      rowsCount: row.rowsCount ?? null,
    }))
}

function readPeriodsForSymbol(symbol: string) {
  const statuses = readJson<Record<string, StoreV5StatusSnapshot>>(storeV5StatusStorageKey, {})
  const status = statuses?.[symbol] ?? null
  const savedPeriods = readShortcutPeriods()
  const directRows = resolveDirectM1Rows(status)
  const direct: PeriodOption[] =
    typeof directRows === 'number' && Number.isFinite(directRows) && directRows > 0
      ? [{ period: 'M1', rowsCount: directRows }]
      : []

  const cellsByPeriod = new Map(
    (status?.aggregated ?? [])
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
  )
  const aggregate = periodOrder.filter((period) => period !== 'M1').flatMap((period) => {
    const rowsCount = cellsByPeriod.get(period)?.rowsCount
    if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
    return [{ period, rowsCount }]
  })

  const merged = new Map<string, PeriodOption>()
  for (const option of [...direct, ...aggregate]) merged.set(option.period, option)
  for (const option of savedPeriods) merged.set(option.period, option)
  return periodOrder.flatMap((period) => {
    const option = merged.get(period)
    return option ? [option] : []
  })
}

function readShortcutMenuPeriods() {
  const savedPeriods = readShortcutPeriods()
  return periodOrder.flatMap((period) => {
    const option = savedPeriods.find((item) => item.period === period)
    return option ? [option] : []
  })
}

function periodToChartPeriod(period: string) {
  return period === 'M1' ? '1m' : period
}

function readSharedSelection() {
  const parsed = readJson<{ symbol?: string; period?: string } | null>(sharedSelectionStorageKey, null)
  return {
    symbol: typeof parsed?.symbol === 'string' ? parsed.symbol : '',
    period: typeof parsed?.period === 'string' ? parsed.period.toUpperCase() : '',
  }
}

function publishSharedSelection(symbol: string, period: string) {
  try {
    window.localStorage.setItem(sharedSelectionStorageKey, JSON.stringify({ symbol, period }))
  } catch {
    // Shared selection persistence is best-effort only.
  }
  window.dispatchEvent(new CustomEvent(sharedSelectionChangedEvent, { detail: { symbol, period } }))
}

export function TopBar({ onOpenChart }: TopBarProps) {
  const [enabled, setEnabled] = useState(readShortcutMenuEnabled)
  const [symbols, setSymbols] = useState<string[]>(readWatchlistSymbols)
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const shared = readSharedSelection()
    const initialSymbols = readWatchlistSymbols()
    return shared.symbol && initialSymbols.includes(shared.symbol) ? shared.symbol : initialSymbols[0] ?? ''
  })
  const [activePeriod, setActivePeriod] = useState(() => readSharedSelection().period || 'M1')
  const [open, setOpen] = useState(false)
  const [refreshVersion, setRefreshVersion] = useState(0)

  const periods = useMemo(readShortcutMenuPeriods, [symbols, refreshVersion])

  useEffect(() => {
    const refresh = () => {
      const nextEnabled = readShortcutMenuEnabled()
      const nextSymbols = readWatchlistSymbols()
      setEnabled(nextEnabled)
      setSymbols(nextSymbols)
      setRefreshVersion((current) => current + 1)
      setSelectedSymbol((current) => (
        current && nextSymbols.includes(current) ? current : nextSymbols[0] ?? ''
      ))
    }

    window.addEventListener(shortcutMenuChangedEvent, refresh)
    window.addEventListener(watchlistChangedEvent, refresh)
    window.addEventListener(storeV5StatusChangedEvent, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(shortcutMenuChangedEvent, refresh)
      window.removeEventListener(watchlistChangedEvent, refresh)
      window.removeEventListener(storeV5StatusChangedEvent, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const syncSelection = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { symbol?: string; period?: string } : readSharedSelection()
      const nextSymbol = typeof detail?.symbol === 'string' ? detail.symbol : ''
      const nextPeriod = typeof detail?.period === 'string' ? detail.period.toUpperCase() : ''
      if (nextSymbol) setSelectedSymbol(nextSymbol)
      if (nextPeriod) setActivePeriod(nextPeriod)
    }

    window.addEventListener(sharedSelectionChangedEvent, syncSelection)
    return () => window.removeEventListener(sharedSelectionChangedEvent, syncSelection)
  }, [])

  useEffect(() => {
    if (periods.some((item) => item.period === activePeriod)) return
    const fallback = periods[0] ?? null
    if (!fallback) return
    setActivePeriod(fallback.period)
  }, [activePeriod, periods])

  function handleSelectSymbol(symbol: string) {
    setSelectedSymbol(symbol)
    setOpen(false)
    const fallback = periods.find((item) => item.period === activePeriod) ?? periods[0] ?? null
    if (!fallback) return
    setActivePeriod(fallback.period)
    publishSharedSelection(symbol, fallback.period)
    const symbolPeriods = readPeriodsForSymbol(symbol)
    const symbolPeriod = symbolPeriods.find((item) => item.period === fallback.period)
    onOpenChart?.({
      symbol,
      period: periodToChartPeriod(fallback.period),
      totalRows: symbolPeriod?.rowsCount ?? fallback.rowsCount ?? null,
    })
  }

  function handleOpenPeriod(option: PeriodOption) {
    if (!selectedSymbol) return
    setActivePeriod(option.period)
    publishSharedSelection(selectedSymbol, option.period)
    const symbolPeriods = readPeriodsForSymbol(selectedSymbol)
    const symbolPeriod = symbolPeriods.find((item) => item.period === option.period)
    onOpenChart?.({
      symbol: selectedSymbol,
      period: periodToChartPeriod(option.period),
      totalRows: symbolPeriod?.rowsCount ?? option.rowsCount ?? null,
    })
  }

  return (
    <header className="ff-topbar">
      <div className="ff-topbar__brand">FractalFrame</div>

      {enabled && symbols.length > 0 && (
        <div className="ff-shortcut-menu">
          <div className="ff-shortcut-symbol" data-open={open}>
            <button
              className="ff-shortcut-symbol__toggle"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              <span>{selectedSymbol || symbols[0]}</span>
              <span aria-hidden="true">⌄</span>
            </button>
            {open && (
              <div className="ff-shortcut-symbol__menu">
                {symbols.map((symbol) => (
                  <button
                    data-active={symbol === selectedSymbol}
                    key={symbol}
                    onClick={() => handleSelectSymbol(symbol)}
                    type="button"
                  >
                    {symbol}
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
                onClick={() => handleOpenPeriod(option)}
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
