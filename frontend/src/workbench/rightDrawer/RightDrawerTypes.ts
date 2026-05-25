import type { MacdIndicatorSettings, MaIndicatorSettings, MrIndicatorSettings, RsiIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, ViIndicatorSettings, VolIndicatorSettings, VwapIndicatorSettings } from './indicatorPersistence'
import type { ChartPageTarget } from '../chart/ChartCoreHost'

export type RightDrawerId = 'drawings' | 'objectTree' | 'indicators' | 'mt5' | 'settings'

export type SupportedChartIndicatorName = 'MA' | 'MACD' | 'MR' | 'RSI' | 'Stoch' | 'TSI' | 'VI' | 'VWAP' | 'Vol'

export type IndicatorShortcutItem = {
  key: string
  loaded: boolean
  name: string
}

export type RightDrawerProps = {
  activeDrawer: RightDrawerId | null
  drawerWidth: number
  indicatorShortcutKeys: string[]
  loadedIndicatorKeys: string[]
  onClose: () => void
  onIndicatorShortcutKeysChange: (keys: string[]) => void
  onLoadIndicator?: (name: SupportedChartIndicatorName, settings?: MacdIndicatorSettings | MaIndicatorSettings | MrIndicatorSettings | RsiIndicatorSettings | StochIndicatorSettings | TsiIndicatorSettings | ViIndicatorSettings | VolIndicatorSettings | VwapIndicatorSettings) => void
  onResize: (width: number) => void
  onToggleDrawer: (drawer: RightDrawerId) => void
  onUnloadIndicator?: (name: SupportedChartIndicatorName) => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
}
