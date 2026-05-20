import { settingsPanelTabs } from './settingsPanelTabs'
import { SettingsCoordinatesPanel } from './SettingsCoordinatesPanel'
import { SettingsEventsPanel } from './SettingsEventsPanel'
import { SettingsLayoutPanel } from './SettingsLayoutPanel'
import './SettingsPanelShell.css'
import './SettingsPanel.css'
import { SettingsStatusPanel } from './SettingsStatusPanel'
import { SettingsSymbolPanel } from './SettingsSymbolPanel'

export type SettingsPanelTab = 'symbol' | 'status' | 'coordinates' | 'layout' | 'trading' | 'alerts' | 'events'

export function SettingsPanel({
  selectedTab,
  onSelectedTabChange,
}: {
  selectedTab: SettingsPanelTab
  onSelectedTabChange: (tab: SettingsPanelTab) => void
}) {
  return (
    <div className="ff-settings-drawer__body">
      <div className="ff-import-selected-tabs ff-settings-tabs" role="tablist" aria-label="Settings panels">
        {settingsPanelTabs.map((tab) => (
          <button
            aria-selected={selectedTab === tab.key}
            className="ff-import-selected-tabs__item ff-settings-tabs__item"
            data-active={selectedTab === tab.key}
            key={tab.key}
            onClick={() => onSelectedTabChange(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ff-settings-panel-shell">
        {selectedTab === 'symbol' && <SettingsSymbolPanel />}
        {selectedTab === 'status' && <SettingsStatusPanel />}
        {selectedTab === 'coordinates' && <SettingsCoordinatesPanel />}
        {selectedTab === 'layout' && <SettingsLayoutPanel />}
        {selectedTab === 'events' && <SettingsEventsPanel />}
        {selectedTab !== 'symbol' && selectedTab !== 'status' && selectedTab !== 'coordinates' && selectedTab !== 'layout' && selectedTab !== 'events' && (
          <div className="ff-settings-placeholder">
            <strong>{settingsPanelTabs.find((tab) => tab.key === selectedTab)?.label}</strong>
            <span>该面板将在后续版本中开放。</span>
          </div>
        )}
      </div>
    </div>
  )
}
