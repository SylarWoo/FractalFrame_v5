import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ChartIndicatorCommand, ChartLoadState } from '../chart/ChartCoreHost'
import type { SupportedChartIndicator } from '../rightDrawer/indicatorDefinitions'
import {
  clearPersistedIndicatorsState,
  readIndicatorPersistenceEnabled,
  readPersistedIndicatorsState,
  writeIndicatorPersistenceEnabled,
  writePersistedIndicatorsState,
} from '../rightDrawer/indicatorPersistence'
import type { PersistedIndicatorsState } from '../rightDrawer/indicatorPersistence'
import {
  createLoadCommand,
  createLoadedIndicatorCommands,
  getIndicatorSettings,
  loadedKeysFromState,
  loadedRecordFromKeys,
  withIndicatorSettings,
} from './indicatorControllerModel'
import type { IndicatorSettings } from './indicatorControllerModel'

export function resolveIndicatorRestoreContextKey(chartLoadState: ChartLoadState | null, chartPeriod: string, chartSymbol: string) {
  if (!chartLoadState || chartLoadState.loading || chartLoadState.rows <= 0) return null
  const loadedSymbol = chartLoadState.loadedSymbol || chartSymbol
  const loadedPeriod = chartLoadState.loadedPeriod || chartPeriod
  return [loadedSymbol, loadedPeriod, chartLoadState.requestedRows, chartLoadState.rows].join(':')
}

export function useIndicatorsController({
  chartLoadState,
  chartPeriod,
  chartSymbol,
}: {
  chartLoadState: ChartLoadState | null
  chartPeriod: string
  chartSymbol: string
}) {
  const [state, setState] = useState(readPersistedIndicatorsState)
  const stateRef = useRef(state)
  const [persistenceEnabled, setPersistenceEnabledState] = useState(readIndicatorPersistenceEnabled)
  const [command, setCommand] = useState<ChartIndicatorCommand | null>(null)
  const commandQueueRef = useRef<ChartIndicatorCommand[]>([])
  const commandTimerRef = useRef<number | null>(null)
  const commandIdRef = useRef(0)
  const dispatchQueuedCommandRef = useRef<() => void>(() => undefined)
  const restoredContextRef = useRef('')

  const loadedIndicatorKeys = useMemo(() => loadedKeysFromState(state), [state])

  const updateState = useCallback((updater: (current: PersistedIndicatorsState) => PersistedIndicatorsState) => {
    setState((current) => {
      const next = updater(current)
      stateRef.current = next
      return next
    })
  }, [])

  const dispatchQueuedCommand = useCallback(() => {
    const next = commandQueueRef.current.shift()
    if (!next) {
      commandTimerRef.current = null
      return
    }
    commandIdRef.current += 1
    setCommand({ ...next, id: commandIdRef.current })
    commandTimerRef.current = window.setTimeout(() => dispatchQueuedCommandRef.current(), 35)
  }, [])

  useEffect(() => {
    dispatchQueuedCommandRef.current = dispatchQueuedCommand
  }, [dispatchQueuedCommand])

  const enqueueCommands = useCallback((commands: ChartIndicatorCommand[] | ChartIndicatorCommand) => {
    const nextCommands = Array.isArray(commands) ? commands : [commands]
    nextCommands.forEach((next) => {
      if (next.action === 'load') {
        commandQueueRef.current = commandQueueRef.current.filter((queued) => queued.action !== 'load' || queued.name !== next.name)
      }
      commandQueueRef.current.push(next)
    })
    if (commandTimerRef.current == null) dispatchQueuedCommand()
  }, [dispatchQueuedCommand])

  const loadIndicator = useCallback((name: SupportedChartIndicator, settings?: IndicatorSettings) => {
    const nextSettings = settings ?? getIndicatorSettings(stateRef.current, name)
    const nextState = withIndicatorSettings({
      ...stateRef.current,
      loaded: { ...stateRef.current.loaded, [name]: true },
    }, name, nextSettings)
    stateRef.current = nextState
    setState(nextState)
    enqueueCommands(createLoadCommand(nextState, name))
  }, [enqueueCommands])

  const unloadIndicator = useCallback((name: SupportedChartIndicator) => {
    updateState((current) => ({
      ...current,
      loaded: { ...current.loaded, [name]: false },
    }))
    enqueueCommands({ action: 'unload', id: 0, name })
  }, [enqueueCommands, updateState])

  const updateIndicatorSettings = useCallback((name: SupportedChartIndicator, settings: IndicatorSettings) => {
    const nextState = withIndicatorSettings(stateRef.current, name, settings)
    stateRef.current = nextState
    setState(nextState)
    if (nextState.loaded[name]) enqueueCommands(createLoadCommand(nextState, name))
  }, [enqueueCommands])

  const setLoadedIndicatorKeys = useCallback((keys: string[]) => {
    updateState((current) => ({
      ...current,
      loaded: loadedRecordFromKeys(keys),
    }))
  }, [updateState])

  const setPersistenceEnabled = useCallback((enabled: boolean) => {
    setPersistenceEnabledState(enabled)
    writeIndicatorPersistenceEnabled(enabled)
    if (!enabled) {
      clearPersistedIndicatorsState()
      return
    }
    writePersistedIndicatorsState(stateRef.current)
  }, [])

  const setSelectedKey = useCallback((selectedKey: string) => {
    updateState((current) => ({ ...current, ui: { ...current.ui, selectedKey } }))
  }, [updateState])

  const setSettingsTab = useCallback((activeTab: PersistedIndicatorsState['ui']['activeTab']) => {
    updateState((current) => ({ ...current, ui: { ...current.ui, activeTab } }))
  }, [updateState])

  const refreshLoadedIndicatorsVisibility = useCallback((targetKey?: string) => {
    enqueueCommands(createLoadedIndicatorCommands(stateRef.current, targetKey))
  }, [enqueueCommands])

  useEffect(() => {
    stateRef.current = state
    if (persistenceEnabled) writePersistedIndicatorsState(state)
  }, [persistenceEnabled, state])

  useEffect(() => () => {
    if (commandTimerRef.current != null) window.clearTimeout(commandTimerRef.current)
    commandTimerRef.current = null
    commandQueueRef.current = []
  }, [])

  useEffect(() => {
    const contextKey = resolveIndicatorRestoreContextKey(chartLoadState, chartPeriod, chartSymbol)
    if (!contextKey) {
      restoredContextRef.current = ''
      return
    }
    if (restoredContextRef.current === contextKey) return
    restoredContextRef.current = contextKey
    refreshLoadedIndicatorsVisibility()
  }, [chartLoadState, chartPeriod, chartSymbol, refreshLoadedIndicatorsVisibility])

  return {
    command,
    loadedIndicatorKeys,
    loadIndicator,
    persistenceEnabled,
    refreshLoadedIndicatorsVisibility,
    selectedKey: state.ui.selectedKey,
    setLoadedIndicatorKeys,
    setPersistenceEnabled,
    setSelectedKey,
    setSettingsTab,
    settings: state,
    settingsTab: state.ui.activeTab,
    unloadIndicator,
    updateIndicatorSettings,
  }
}

export type IndicatorsController = ReturnType<typeof useIndicatorsController>
