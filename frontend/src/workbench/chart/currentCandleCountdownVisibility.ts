import { readWatchlistRealtimeEnabled } from '../mt5DataCenter/storeV6Persistence'
import { readMarketStatusTitleSnapshot } from '../mt5DataCenter/marketStatusTitleState'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { readSymbolLabelVisibleParts } from './chartStyleReaders'

export function readCurrentCandleCountdownActive(symbol: string) {
  const settingVisible = readSettingsBooleanValue(
    chartSettingKeys.currentCandleCountdownVisible,
    chartSettingDefaults.currentCandleCountdownVisible,
  )
  const valueVisible = readSymbolLabelVisibleParts().includes('value')
  const marketStatus = readMarketStatusTitleSnapshot(symbol)?.status
  return settingVisible && valueVisible && readWatchlistRealtimeEnabled() && marketStatus?.status !== 'closed'
}
