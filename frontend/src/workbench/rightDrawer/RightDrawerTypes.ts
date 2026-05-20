export type RightDrawerProps = {
  activeDrawer: 'mt5' | 'settings' | null
  drawerWidth: number
  onClose: () => void
  onResize: (width: number) => void
  onToggleDrawer: (drawer: 'mt5' | 'settings') => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}
