import type { ChartPageNavigation, ChartPageTarget } from '../chart/chartRuntimeTypes'
import type { StoreV6HistoryPageWindow } from '../chart/historyPageWindowV2'
import type { MorganRangeSegment } from '../chart/morganRangeModel'
import type { IndicatorsController } from '../indicators/useIndicatorsController'
import type { SupportedChartIndicator } from './indicatorDefinitions'

export type RightDrawerId = 'drawings' | 'objectTree' | 'indicators' | 'strategy' | 'mt5' | 'settings'

export type SupportedChartIndicatorName = SupportedChartIndicator

export type IndicatorShortcutItem = {
  key: string
  loaded: boolean
  name: string
}

export type StrategyShortcutItem = {
  key: string
  loaded: boolean
  name: string
  system: string
}

export type RightDrawerProps = {
  activeDrawer: RightDrawerId | null
  chartPeriod: string
  drawerWidth: number
  indicatorShortcutKeys: string[]
  indicatorsController: IndicatorsController
  loadedIndicatorKeys: string[]
  loadedStrategyKeys: string[]
  morganRangeSegment?: MorganRangeSegment | null
  onClose: () => void
  onIndicatorShortcutKeysChange: (keys: string[]) => void
  onResize: (width: number) => void
  onStrategyLoad: (key: string) => void
  onStrategyPersistenceEnabledChange: (enabled: boolean) => void
  onStrategyShortcutKeysChange: (keys: string[]) => void
  onStrategyUnload: (key: string) => void
  onToggleDrawer: (drawer: RightDrawerId) => void
  strategyPersistenceEnabled: boolean
  strategyShortcutKeys: string[]
  onOpenChart?: (options: { historyPageWindow?: StoreV6HistoryPageWindow | null; pageNavigation?: ChartPageNavigation | null; realtimeEnabled?: boolean; symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
}
