import type { MaIndicatorSettings, RsiIndicatorSettings } from './indicatorPersistence'

export type RightDrawerId = 'indicators' | 'mt5' | 'settings'

export type RightDrawerProps = {
  activeDrawer: RightDrawerId | null
  drawerWidth: number
  onClose: () => void
  onLoadIndicator?: (name: 'MA' | 'RSI', settings: MaIndicatorSettings | RsiIndicatorSettings) => void
  onResize: (width: number) => void
  onToggleDrawer: (drawer: RightDrawerId) => void
  onUnloadIndicator?: (name: 'MA' | 'RSI') => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}
