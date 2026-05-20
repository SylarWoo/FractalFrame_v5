import { useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readSettingsBooleanValue, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './chartSettingsSchema'
import { SettingsLineSwatch } from './SettingsSwatches'
import './SettingsEventsPanel.css'

export function SettingsEventsPanel() {
  const [sessionBreakVisible, setSessionBreakVisible] = useState(() => readSettingsBooleanValue(chartSettingKeys.sessionBreakVisible, chartSettingDefaults.sessionBreakVisible))

  return (
    <div className="ff-settings-events-panel">
      <div className="ff-settings-events-kicker">事件</div>
      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>观点</span>
        <OpenableSelect ariaLabel="观点" defaultValue="all" options={[
          { label: '所有观点', value: 'all' },
          { label: '只显示我的观点', value: 'mine' },
          { label: '隐藏', value: 'hidden' },
        ]} />
        <button aria-label="观点说明" className="ff-settings-events-help" type="button">?</button>
      </div>
      <div className="ff-settings-events-row">
        <input
          checked={sessionBreakVisible}
          onChange={(event) => {
            const next = event.currentTarget.checked
            setSessionBreakVisible(next)
            writeSettingsSymbolStateValue(chartSettingKeys.sessionBreakVisible, next)
          }}
          type="checkbox"
        />
        <span>交易日间隔</span>
        <SettingsLineSwatch color="#93b7f4" storageKey="events.sessionBreak.color" />
      </div>
      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>经济事件</span>
      </div>
      <div className="ff-settings-events-row ff-settings-events-row--nested">
        <input type="checkbox" />
        <span>只显示未来事件</span>
      </div>
      <div className="ff-settings-events-row ff-settings-events-row--nested">
        <input defaultChecked type="checkbox" />
        <span>事件线</span>
        <SettingsLineSwatch color="#9b9b9b" storageKey="events.eventLine.color" />
      </div>
      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>最新消息</span>
      </div>
      <div className="ff-settings-events-row">
        <input type="checkbox" />
        <span>新闻通知</span>
      </div>
    </div>
  )
}
