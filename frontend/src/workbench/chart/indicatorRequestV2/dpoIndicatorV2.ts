import { normalizeDpoSettings, type DpoIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { calculateTradingViewDpoRows, type DpoIndicatorRow } from '../tradingViewDpoIndicator'
import { createOhlcSubPaneIndicatorDefinitionV2 } from './ohlcSubPaneIndicatorDefinitionV2'

export const storeV6DpoIndicatorIdV2 = 'DPO'
export const storeV6DpoPaneIdV2 = 'dpo_pane'

export const storeV6DpoIndicatorDefinitionV2 = createOhlcSubPaneIndicatorDefinitionV2<DpoIndicatorRow, DpoIndicatorSettings>({
  calculateRows: calculateTradingViewDpoRows,
  id: storeV6DpoIndicatorIdV2,
  normalizeSettings: normalizeDpoSettings,
  paneId: storeV6DpoPaneIdV2,
  source: 'store-v6-dpo-indicator-v2',
  warmupRows: (settings) => settings.length + Math.floor(settings.length / 2) + 1,
})
