import type { Chart } from 'klinecharts'
import { installMainVolumeOverlay } from '../mainVolumeIndicator'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { storeV6VolIndicatorIdV2 } from '../indicatorRequestV2'
import type { VolIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'

type MainVolumeOverlayHandle = ReturnType<typeof installMainVolumeOverlay>

function findVolPane(frame: KLineChartRenderFrameV2) {
  return frame.panes[storeV6VolIndicatorIdV2] ?? frame.panes.Vol ?? frame.panes.vol ?? null
}

export function installKLineChartMainVolumeOverlayV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  let overlay: MainVolumeOverlayHandle | null = null
  let enabled = false

  const apply = (nextFrame: KLineChartRenderFrameV2) => {
    const pane = findVolPane(nextFrame)
    if (!pane || pane.renderRole !== 'main-overlay') {
      if (enabled) {
        overlay?.destroy()
        overlay = null
        enabled = false
      }
      return
    }

    const settings = pane.settings as Partial<VolIndicatorSettings> | undefined
    if (!overlay) overlay = installMainVolumeOverlay(chart, settings)
    else overlay.updateSettings(settings)
    enabled = true
  }

  apply(frame)

  return {
    destroy: () => {
      overlay?.destroy()
      overlay = null
      enabled = false
    },
    updateFrame: apply,
  }
}
