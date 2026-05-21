import type { MaIndicatorSettings, RsiIndicatorSettings, VolIndicatorSettings } from './indicatorPersistence'

export type RightDrawerId = 'indicators' | 'mt5' | 'settings'

export type SupportedChartIndicatorName = 'MA' | 'RSI' | 'VWAP' | 'Vol'

export type RightDrawerProps = {
  activeDrawer: RightDrawerId | null
  drawerWidth: number
  onClose: () => void
  onLoadIndicator?: (name: SupportedChartIndicatorName, settings?: MaIndicatorSettings | RsiIndicatorSettings | VolIndicatorSettings) => void
  onResize: (width: number) => void
  onToggleDrawer: (drawer: RightDrawerId) => void
  onUnloadIndicator?: (name: SupportedChartIndicatorName) => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}
