import type { ChartPageTarget } from '../chart/ChartCoreHost'
import type { IndicatorsController } from '../indicators/useIndicatorsController'
import type { SupportedChartIndicator } from './indicatorDefinitions'

export type RightDrawerId = 'drawings' | 'objectTree' | 'indicators' | 'mt5' | 'settings'

export type SupportedChartIndicatorName = SupportedChartIndicator

export type IndicatorShortcutItem = {
  key: string
  loaded: boolean
  name: string
}

export type RightDrawerProps = {
  activeDrawer: RightDrawerId | null
  drawerWidth: number
  indicatorShortcutKeys: string[]
  indicatorsController: IndicatorsController
  loadedIndicatorKeys: string[]
  onClose: () => void
  onIndicatorShortcutKeysChange: (keys: string[]) => void
  onResize: (width: number) => void
  onToggleDrawer: (drawer: RightDrawerId) => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
}
