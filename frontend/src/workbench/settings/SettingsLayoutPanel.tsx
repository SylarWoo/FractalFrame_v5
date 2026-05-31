import { useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { openWorkspaceTemplateFile, saveWorkspaceTemplateFile } from '../persistence/workspaceTemplatePersistence'
import { SettingsTextInput } from './SettingsSharedControls'
import { SettingsColorSwatch, SettingsLineSwatch } from './SettingsSwatches'
import './SettingsLayoutPanel.css'

const text = {
  axis: '\u5750\u6807',
  axisLine: '\u7ebf\u6761',
  axisText: '\u6587\u672c',
  axisTextSize: '\u5750\u6807\u6587\u672c\u5927\u5c0f',
  background: '\u80cc\u666f',
  basicStyle: '\u56fe\u8868\u57fa\u672c\u6837\u5f0f',
  buttons: '\u6309\u94ae',
  crosshair: '\u5341\u5b57\u7ebf',
  grid: '\u7f51\u683c\u7ebf',
  horizontal: '\u6c34\u5e73',
  hidden: '\u9690\u85cf',
  layoutLoaded: '\u5df2\u8f7d\u5165',
  layoutSaved: '\u5df2\u4fdd\u5b58',
  loadFailed: '\u8f7d\u5165\u5931\u8d25',
  loadTemplate: '\u8f7d\u5165\u6a21\u677f',
  margin: '\u5229\u6da6\u7387',
  navigation: '\u5bfc\u822a',
  onMove: '\u9f20\u6807\u79fb\u52a8\u65f6\u53ef\u89c1',
  panes: '\u7a97\u683c',
  paneSeparator: '\u7a97\u683c\u5206\u9694\u7b26',
  percent: '%',
  refreshing: '\u6b63\u5728\u5237\u65b0',
  rightBars: '\u53f3\u4fa7',
  rows: '\u6839\u7ebf',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  saveTemplate: '\u4fdd\u5b58\u6a21\u677f',
  template: '\u6a21\u677f',
  top: '\u9876\u90e8',
  bottom: '\u5e95\u90e8',
  vertical: '\u5782\u76f4',
  verticalHorizontal: '\u5782\u76f4\u548c\u6c34\u5e73',
  watermark: '\u6c34\u5370',
}

export function SettingsLayoutPanel() {
  const [templateStatus, setTemplateStatus] = useState('')

  const handleSaveTemplate = async () => {
    try {
      const payload = await saveWorkspaceTemplateFile()
      if (!payload) return
      setTemplateStatus(`${text.layoutSaved} ${Object.keys(payload.localStorage).length} items`)
    } catch {
      setTemplateStatus(text.saveFailed)
    }
  }

  const handleLoadTemplate = async () => {
    try {
      const result = await openWorkspaceTemplateFile()
      if (!result) return
      setTemplateStatus(`${text.layoutLoaded} ${result.keys} items, ${text.refreshing}`)
      window.setTimeout(() => window.location.reload(), 80)
    } catch {
      setTemplateStatus(text.loadFailed)
    }
  }

  return (
    <div className="ff-settings-layout-panel">
      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-title">{text.basicStyle}</div>
        <div className="ff-settings-layout-row">
          <span>{text.background}</span>
          <OpenableSelect ariaLabel={text.background} defaultValue="solid" storageKey="layout.background.mode" options={[
            { label: 'Solid', value: 'solid' },
            { label: '\u6e10\u53d8', value: 'gradient' },
          ]} />
          <SettingsColorSwatch color="#ffffff" storageKey="layout.background.color" />
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.grid}</span>
          <OpenableSelect
            ariaLabel={text.grid}
            defaultValue="both"
            storageKey="layout.grid.mode"
            options={[
              { label: text.verticalHorizontal, value: 'both' },
              { label: text.vertical, value: 'vertical' },
              { label: text.horizontal, value: 'horizontal' },
              { label: text.hidden, value: 'hidden' },
            ]}
          />
          <div className="ff-settings-layout-swatches">
            <SettingsColorSwatch color="#eef2f8" storageKey="layout.grid.vertical.color" />
            <SettingsColorSwatch color="#eef2f8" storageKey="layout.grid.horizontal.color" />
          </div>
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.paneSeparator}</span>
          <SettingsLineSwatch color="#858b98" storageKey="layout.paneSeparator.color" />
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.crosshair}</span>
          <SettingsLineSwatch color="#e91e63" storageKey="layout.crosshair.color" />
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.watermark}</span>
          <OpenableSelect ariaLabel={text.watermark} defaultValue="replay" storageKey="layout.watermark.mode" options={[
            { label: '\u56de\u653e\u6a21\u5f0f', value: 'replay' },
            { label: '\u5546\u54c1\u4ee3\u7801', value: 'symbol' },
            { label: text.hidden, value: 'hidden' },
          ]} />
          <SettingsColorSwatch checkerboard storageKey="layout.watermark.color" />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">{text.axis}</div>
        <div className="ff-settings-layout-row ff-settings-layout-row--text">
          <span>{text.axisText}</span>
          <SettingsColorSwatch color="#5f6675" storageKey="layout.axisText.color" />
          <OpenableSelect
            ariaLabel={text.axisTextSize}
            defaultValue="12"
            storageKey="layout.axisText.size"
            options={[
              { label: '10', value: '10' },
              { label: '11', value: '11' },
              { label: '12', value: '12' },
              { label: '13', value: '13' },
              { label: '14', value: '14' },
            ]}
          />
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.axisLine}</span>
          <SettingsColorSwatch color="#858b98" storageKey="layout.axisLine.color" />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">{text.buttons}</div>
        <div className="ff-settings-layout-row ff-settings-layout-row--wide-select">
          <span>{text.navigation}</span>
          <OpenableSelect ariaLabel={text.navigation} defaultValue="on-move" storageKey="layout.navigation.mode" options={[
            { label: text.onMove, value: 'on-move' },
            { label: '\u603b\u662f\u53ef\u89c1', value: 'always' },
            { label: text.hidden, value: 'hidden' },
          ]} />
        </div>
        <div className="ff-settings-layout-row ff-settings-layout-row--wide-select">
          <span>{text.panes}</span>
          <OpenableSelect ariaLabel={text.panes} defaultValue="on-move" storageKey="layout.paneButtons.mode" options={[
            { label: text.onMove, value: 'on-move' },
            { label: '\u603b\u662f\u53ef\u89c1', value: 'always' },
            { label: text.hidden, value: 'hidden' },
          ]} />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">{text.margin}</div>
        <div className="ff-settings-layout-row">
          <span>{text.top}</span>
          <SettingsTextInput ariaLabel={text.top} defaultValue="10" storageKey="layout.margin.top" />
          <em>{text.percent}</em>
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.bottom}</span>
          <SettingsTextInput ariaLabel={text.bottom} defaultValue="8" storageKey="layout.margin.bottom" />
          <em>{text.percent}</em>
        </div>
        <div className="ff-settings-layout-row">
          <span>{text.rightBars}</span>
          <SettingsTextInput ariaLabel={text.rightBars} defaultValue="10" storageKey="layout.margin.rightBars" />
          <em>{text.rows}</em>
        </div>
      </section>

      <section className="ff-settings-layout-group ff-settings-layout-template-group">
        <div className="ff-settings-layout-kicker">{text.template}</div>
        <div className="ff-settings-layout-template-actions">
          <button onClick={handleSaveTemplate} type="button">{text.saveTemplate}</button>
          <button onClick={handleLoadTemplate} type="button">{text.loadTemplate}</button>
        </div>
        {templateStatus ? <div className="ff-settings-layout-template-status">{templateStatus}</div> : null}
      </section>
    </div>
  )
}

