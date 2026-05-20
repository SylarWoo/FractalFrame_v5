import type { SettingsPanelTab } from './SettingsPanel'

export const settingsPanelTabs: Array<{ key: SettingsPanelTab; label: string }> = [
  { key: 'symbol', label: '商品代码' },
  { key: 'status', label: '状态行' },
  { key: 'coordinates', label: '坐标和线条' },
  { key: 'layout', label: '版面' },
  { key: 'trading', label: '交易' },
  { key: 'alerts', label: '警报' },
  { key: 'events', label: '事件' },
]
