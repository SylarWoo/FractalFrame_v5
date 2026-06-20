import { normalizeViSettings, type ViIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { calculateTradingViewViRows, type ViIndicatorRow } from '../tradingViewViIndicator'
import { createOhlcSubPaneIndicatorDefinitionV2 } from './ohlcSubPaneIndicatorDefinitionV2'

export const storeV6ViIndicatorIdV2 = 'VI'
export const storeV6ViPaneIdV2 = 'vi_pane'

export const storeV6ViIndicatorDefinitionV2 = createOhlcSubPaneIndicatorDefinitionV2<ViIndicatorRow, ViIndicatorSettings>({
  calculateRows: calculateTradingViewViRows,
  id: storeV6ViIndicatorIdV2,
  normalizeSettings: normalizeViSettings,
  paneId: storeV6ViPaneIdV2,
  source: 'store-v6-vi-indicator-v2',
  warmupRows: (settings) => settings.length + 1,
})
