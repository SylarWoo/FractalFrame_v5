import type { MutableRefObject } from 'react'
import type { Chart } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import type { ChartIndicatorCommand } from './ChartCoreHost'
import { createIndicatorSnapshotRows, writeIndicatorPageSnapshot } from './indicatorPageSnapshotStore'
import { mainVolumeIndicatorName } from './mainVolumeIndicator'
import { scheduleResetIndicatorYAxisAutoScale } from './chartAxisInteraction'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import type { VolIndicatorSettings } from '../rightDrawer/indicatorPersistence'

export type IndicatorPaneCommandName = 'DPO' | 'MACD' | 'RSI' | 'SQZMOM' | 'Stoch' | 'TSI' | 'VDO' | 'VI' | 'AO' | 'VMI'
export type CandleIndicatorCommandName = 'MA' | 'VWAP'

export type IndicatorPaneConfig = {
  ensureRegistered: () => void
  minHeight: number
  name: IndicatorPaneCommandName
  observeHeight: () => void
  observerRef: MutableRefObject<ResizeObserver | null>
  paneId: string
  resolveCalcParams?: (command: ChartIndicatorCommand) => unknown
  resetPaneIds?: string[]
  storageKey: string
}

export type CandleIndicatorConfig = {
  ensureRegistered: () => void
  name: CandleIndicatorCommandName
  resolveCalcParams?: (command: ChartIndicatorCommand) => unknown
}

type IndicatorSnapshotRowsInput = Omit<Partial<Parameters<typeof createIndicatorSnapshotRows>[0]>, 'period' | 'rows' | 'symbol'>

type VolumeOverlay = {
  destroy: () => void
  updateSettings: (settings?: Partial<VolIndicatorSettings>) => void
}

export function persistPaneHeightAndDisconnect({
  chart,
  config,
  writeStoredPaneHeight,
}: {
  chart: Chart
  config: IndicatorPaneConfig
  writeStoredPaneHeight: (storageKey: string, height: number) => void
}) {
  const size = chart.getSize(config.paneId)
  if (size?.height) writeStoredPaneHeight(config.storageKey, size.height)
  config.observerRef.current?.disconnect()
  config.observerRef.current = null
}

export function resetIndicatorAxis(chart: Chart, config: IndicatorPaneConfig) {
  if (config.resetPaneIds) scheduleResetIndicatorYAxisAutoScale(chart, config.resetPaneIds)
  scheduleResetIndicatorYAxisAutoScale(chart)
}

export function applyPaneIndicatorCommand({
  chart,
  command,
  config,
  isIndicatorVisible,
  readStoredPaneHeight,
  refreshChartDrawings,
  writeStoredPaneHeight,
}: {
  chart: Chart
  command: ChartIndicatorCommand
  config: IndicatorPaneConfig
  isIndicatorVisible: (name: ChartIndicatorCommand['name']) => boolean
  readStoredPaneHeight: (storageKey: string) => number
  refreshChartDrawings: () => void
  writeStoredPaneHeight: (storageKey: string, height: number) => void
}) {
  config.ensureRegistered()

  if (command.action === 'unload') {
    persistPaneHeightAndDisconnect({ chart, config, writeStoredPaneHeight })
    chart.removeIndicator(config.paneId, config.name)
    resetIndicatorAxis(chart, config)
    return
  }

  if (!isIndicatorVisible(config.name)) {
    persistPaneHeightAndDisconnect({ chart, config, writeStoredPaneHeight })
    chart.removeIndicator(config.paneId, config.name)
    resetIndicatorAxis(chart, config)
    return
  }

  const calcParams = [config.resolveCalcParams ? config.resolveCalcParams(command) : command.settings]
  if (chart.getIndicatorByPaneId(config.paneId, config.name)) {
    chart.overrideIndicator({ name: config.name, calcParams }, config.paneId, config.observeHeight)
    resetIndicatorAxis(chart, config)
    return
  }

  chart.createIndicator(
    { name: config.name, calcParams },
    false,
    { id: config.paneId, height: readStoredPaneHeight(config.storageKey), minHeight: config.minHeight },
    () => {
      config.observeHeight()
      refreshChartDrawings()
      resetIndicatorAxis(chart, config)
    },
  )
  resetIndicatorAxis(chart, config)
}

export function applySnapshotPaneIndicatorCommand({
  calcParams,
  chart,
  command,
  config,
  createSnapshotRows,
  isIndicatorVisible,
  pageKey,
  period,
  readStoredPaneHeight,
  refreshChartDrawings,
  settingsHash,
  settingsHashKey,
  symbol,
  writeStoredPaneHeight,
}: {
  calcParams: unknown[]
  chart: Chart
  command: ChartIndicatorCommand
  config: IndicatorPaneConfig
  createSnapshotRows: (realRows: KLineData[], dataList: KLineData[]) => IndicatorSnapshotRowsInput
  isIndicatorVisible: (name: ChartIndicatorCommand['name']) => boolean
  pageKey: string
  period: string
  readStoredPaneHeight: (storageKey: string) => number
  refreshChartDrawings: () => void
  settingsHash: string
  settingsHashKey: string
  symbol: string
  writeStoredPaneHeight: (storageKey: string, height: number) => void
}) {
  config.ensureRegistered()

  if (command.action === 'unload' || !isIndicatorVisible(config.name)) {
    persistPaneHeightAndDisconnect({ chart, config, writeStoredPaneHeight })
    chart.removeIndicator(config.paneId, config.name)
    resetIndicatorAxis(chart, config)
    return
  }

  const dataList = chart.getDataList()
  const realRows = stripFuturePlaceholders(dataList)
  writeIndicatorPageSnapshot({
    pageKey,
    period: period.trim().toUpperCase(),
    rows: createIndicatorSnapshotRows({
      period,
      rows: dataList,
      symbol,
      ...createSnapshotRows(realRows, dataList),
    }),
    settingsHash,
    settingsHashKey,
    symbol,
  })

  if (chart.getIndicatorByPaneId(config.paneId, config.name)) {
    chart.overrideIndicator({ name: config.name, calcParams }, config.paneId, config.observeHeight)
    resetIndicatorAxis(chart, config)
    return
  }

  chart.createIndicator(
    { name: config.name, calcParams },
    false,
    { id: config.paneId, height: readStoredPaneHeight(config.storageKey), minHeight: config.minHeight },
    () => {
      config.observeHeight()
      refreshChartDrawings()
      resetIndicatorAxis(chart, config)
    },
  )
  resetIndicatorAxis(chart, config)
}

export function applyCandleIndicatorCommand({
  chart,
  command,
  config,
  isIndicatorVisible,
}: {
  chart: Chart
  command: ChartIndicatorCommand
  config: CandleIndicatorConfig
  isIndicatorVisible: (name: ChartIndicatorCommand['name']) => boolean
}) {
  config.ensureRegistered()

  if (command.action === 'unload') {
    chart.removeIndicator('candle_pane', config.name)
    return
  }

  if (!isIndicatorVisible(config.name)) {
    chart.removeIndicator('candle_pane', config.name)
    return
  }

  const calcParams = [config.resolveCalcParams ? config.resolveCalcParams(command) : command.settings]
  if (chart.getIndicatorByPaneId('candle_pane', config.name)) {
    chart.overrideIndicator({ name: config.name, calcParams }, 'candle_pane')
    return
  }
  chart.createIndicator({ name: config.name, calcParams }, true, { id: 'candle_pane' })
}

export function applySnapshotCandleIndicatorCommand({
  calcParams,
  chart,
  command,
  config,
  createSnapshotRows,
  isIndicatorVisible,
  pageKey,
  period,
  settingsHash,
  settingsHashKey,
  symbol,
}: {
  calcParams: unknown[]
  chart: Chart
  command: ChartIndicatorCommand
  config: CandleIndicatorConfig
  createSnapshotRows: (realRows: KLineData[], dataList: KLineData[]) => IndicatorSnapshotRowsInput
  isIndicatorVisible: (name: ChartIndicatorCommand['name']) => boolean
  pageKey: string
  period: string
  settingsHash: string
  settingsHashKey: string
  symbol: string
}) {
  config.ensureRegistered()

  if (command.action === 'unload' || !isIndicatorVisible(config.name)) {
    chart.removeIndicator('candle_pane', config.name)
    return
  }

  const dataList = chart.getDataList()
  const realRows = stripFuturePlaceholders(dataList)
  writeIndicatorPageSnapshot({
    pageKey,
    period: period.trim().toUpperCase(),
    rows: createIndicatorSnapshotRows({
      period,
      rows: dataList,
      symbol,
      ...createSnapshotRows(realRows, dataList),
    }),
    settingsHash,
    settingsHashKey,
    symbol,
  })

  if (chart.getIndicatorByPaneId('candle_pane', config.name)) {
    chart.overrideIndicator({ name: config.name, calcParams }, 'candle_pane')
    return
  }
  chart.createIndicator({ name: config.name, calcParams }, true, { id: 'candle_pane' })
}

export function applyVolumeCommand({
  chart,
  command,
  ensureRegistered,
  installOverlay,
  isIndicatorVisible,
  overlayRef,
  refreshPane,
}: {
  chart: Chart
  command: ChartIndicatorCommand
  ensureRegistered: () => void
  installOverlay: (chart: Chart, settings?: Partial<VolIndicatorSettings>) => VolumeOverlay | null
  isIndicatorVisible: (name: ChartIndicatorCommand['name']) => boolean
  overlayRef: MutableRefObject<VolumeOverlay | null>
  refreshPane: (chart: unknown, paneId: string) => void
}) {
  ensureRegistered()
  const settings = command.name === 'Vol' ? command.settings : undefined

  if (command.action === 'unload') {
    chart.removeIndicator('candle_pane', mainVolumeIndicatorName)
    overlayRef.current?.destroy()
    overlayRef.current = null
    refreshPane(chart, 'candle_pane')
    return
  }

  if (!isIndicatorVisible('Vol')) {
    chart.removeIndicator('candle_pane', mainVolumeIndicatorName)
    overlayRef.current?.destroy()
    overlayRef.current = null
    refreshPane(chart, 'candle_pane')
    return
  }
  if (chart.getIndicatorByPaneId('candle_pane', mainVolumeIndicatorName)) {
    chart.overrideIndicator({ name: mainVolumeIndicatorName, calcParams: [settings], zLevel: -20 }, 'candle_pane')
  } else {
    chart.createIndicator({ name: mainVolumeIndicatorName, calcParams: [settings], zLevel: -20 }, true, { id: 'candle_pane' })
  }
  if (overlayRef.current) {
    overlayRef.current.updateSettings(settings)
  } else {
    overlayRef.current = installOverlay(chart, settings)
  }
  refreshPane(chart, 'candle_pane')
}
