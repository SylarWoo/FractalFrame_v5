import { useEffect, useState } from 'react'
import { ChartCoreHost } from './chart/ChartCoreHost'
import { RightDrawer } from './rightDrawer/RightDrawer'
import { TopBar } from './topbar/TopBar'
import './AppShell.css'

const drawerWidthStorageKey = 'fractalframe:rightWidgetDrawerWidthPx:v1'

function getInitialDrawerWidth() {
  const fallbackWidth = 280

  try {
    const raw = window.localStorage.getItem(drawerWidthStorageKey)
    const value = raw == null ? fallbackWidth : Number(raw)
    return Math.max(220, Math.min(900, Math.round(value)))
  } catch {
    return fallbackWidth
  }
}

export function AppShell() {
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const [rightDrawerWidth, setRightDrawerWidth] = useState(getInitialDrawerWidth)
  const [chartTarget, setChartTarget] = useState<{ symbol: string; period: string; limit?: number }>({
    symbol: 'XAUUSDm',
    period: '1m',
  })

  useEffect(() => {
    const resize = () => window.dispatchEvent(new Event('resize'))
    resize()
    const timeoutId = window.setTimeout(resize, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [rightDrawerOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(drawerWidthStorageKey, String(rightDrawerWidth))
    } catch {
      // Width persistence is best-effort only.
    }
  }, [rightDrawerWidth])

  return (
    <div className="ff-app-shell">
      <TopBar />

      <main
        className="ff-app-main"
        data-right-drawer-open={rightDrawerOpen}
        style={{
          ['--ff-right-drawer-width' as string]: `${rightDrawerWidth}px`,
        }}
      >
        <ChartCoreHost limit={chartTarget.limit} period={chartTarget.period} symbol={chartTarget.symbol} />
        <RightDrawer
          drawerWidth={rightDrawerWidth}
          open={rightDrawerOpen}
          onClose={() => setRightDrawerOpen(false)}
          onOpenChart={setChartTarget}
          onResize={setRightDrawerWidth}
          onToggle={() => setRightDrawerOpen((current) => !current)}
        />
      </main>
    </div>
  )
}
