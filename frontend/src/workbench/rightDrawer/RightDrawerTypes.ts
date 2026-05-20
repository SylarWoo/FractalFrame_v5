import type { ChartLoadState } from '../chart/ChartCoreHost'

export type RightDrawerProps = {
  activeDrawer: 'mt5' | 'settings' | null
  chartLoadState?: ChartLoadState | null
  drawerWidth: number
  onClose: () => void
  onJumpChartToTime?: (timestamp: number) => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onResize: (width: number) => void
  onResetChartToLatest?: () => void
  onToggleDrawer: (drawer: 'mt5' | 'settings') => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}
