import { useEffect, useMemo, useState } from 'react'
import {
  publishSharedSelection,
  readSharedSelection,
  readShortcutMenuEnabled,
  readWatchlistSymbols,
  sharedSelectionChangedEvent,
  shortcutMenuChangedEvent,
  storeV5StatusChangedEvent,
  watchlistChangedEvent,
} from '../mt5DataCenter/storeV5Persistence'
import {
  periodToChartPeriod,
  readPeriodsForSymbol,
  readShortcutMenuPeriods,
} from './topbarPeriodUtils'
import type { PeriodOption } from './topbarPeriodUtils'

export type OpenChartOptions = {
  symbol: string
  period: string
  totalRows?: number | null
  reloadId?: number
}

type UseShortcutMenuStateOptions = {
  onOpenChart?: (options: OpenChartOptions) => void
}

export function useShortcutMenuState({ onOpenChart }: UseShortcutMenuStateOptions) {
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

  function selectSymbol(symbol: string) {
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

  function openPeriod(option: PeriodOption) {
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

  return {
    activePeriod,
    enabled,
    open,
    openPeriod,
    periods,
    selectedSymbol,
    selectSymbol,
    setOpen,
    symbols,
  }
}
