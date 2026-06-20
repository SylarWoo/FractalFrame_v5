import { normalizeMacdSettings, type MacdIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import { calculateTradingViewMacdRows, type MacdIndicatorRow } from '../tradingViewMacdIndicator'
import { createOhlcSubPaneIndicatorDefinitionV2 } from './ohlcSubPaneIndicatorDefinitionV2'

export const storeV6MacdIndicatorIdV2 = 'MACD'
export const storeV6MacdPaneIdV2 = 'macd_pane'

export const storeV6MacdIndicatorDefinitionV2 = createOhlcSubPaneIndicatorDefinitionV2<MacdIndicatorRow, MacdIndicatorSettings>({
  calculateRows: calculateTradingViewMacdRows,
  id: storeV6MacdIndicatorIdV2,
  normalizeSettings: normalizeMacdSettings,
  paneId: storeV6MacdPaneIdV2,
  source: 'store-v6-macd-indicator-v2',
  warmupRows: (settings) => Math.max(settings.fastLength, settings.slowLength) + settings.signalLength,
})
