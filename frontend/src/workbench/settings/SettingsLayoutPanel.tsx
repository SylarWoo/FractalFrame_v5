import { OpenableSelect } from '../controls/OpenableSelect'
import { SettingsTextInput } from './SettingsSharedControls'
import { SettingsColorSwatch, SettingsLineSwatch } from './SettingsSwatches'
import './SettingsLayoutPanel.css'

export function SettingsLayoutPanel() {
  return (
    <div className="ff-settings-layout-panel">
      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-title">图表基本样式</div>
        <div className="ff-settings-layout-row">
          <span>背景</span>
          <OpenableSelect ariaLabel="背景" defaultValue="solid" storageKey="layout.background.mode" options={[
            { label: 'Solid', value: 'solid' },
            { label: '渐变', value: 'gradient' },
          ]} />
          <SettingsColorSwatch color="#ffffff" storageKey="layout.background.color" />
        </div>
        <div className="ff-settings-layout-row">
          <span>网格线</span>
          <OpenableSelect
            ariaLabel="网格线"
            defaultValue="both"
            storageKey="layout.grid.mode"
            options={[
              { label: '垂直和水平', value: 'both' },
              { label: '垂直', value: 'vertical' },
              { label: '水平', value: 'horizontal' },
              { label: '隐藏', value: 'hidden' },
            ]}
          />
          <div className="ff-settings-layout-swatches">
            <SettingsColorSwatch color="#eef2f8" storageKey="layout.grid.vertical.color" />
            <SettingsColorSwatch color="#eef2f8" storageKey="layout.grid.horizontal.color" />
          </div>
        </div>
        <div className="ff-settings-layout-row">
          <span>窗格分隔符</span>
          <SettingsLineSwatch color="#858b98" storageKey="layout.paneSeparator.color" />
        </div>
        <div className="ff-settings-layout-row">
          <span>十字线</span>
          <SettingsLineSwatch color="#e91e63" storageKey="layout.crosshair.color" />
        </div>
        <div className="ff-settings-layout-row">
          <span>水印</span>
          <OpenableSelect ariaLabel="水印" defaultValue="replay" storageKey="layout.watermark.mode" options={[
            { label: '回放模式', value: 'replay' },
            { label: '商品代码', value: 'symbol' },
            { label: '隐藏', value: 'hidden' },
          ]} />
          <SettingsColorSwatch checkerboard storageKey="layout.watermark.color" />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">坐标</div>
        <div className="ff-settings-layout-row ff-settings-layout-row--text">
          <span>文本</span>
          <SettingsColorSwatch color="#5f6675" storageKey="layout.axisText.color" />
          <OpenableSelect
            ariaLabel="坐标文本大小"
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
          <span>线条</span>
          <SettingsColorSwatch color="#858b98" storageKey="layout.axisLine.color" />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">按钮</div>
        <div className="ff-settings-layout-row ff-settings-layout-row--wide-select">
          <span>导航</span>
          <OpenableSelect ariaLabel="导航" defaultValue="on-move" storageKey="layout.navigation.mode" options={[
            { label: '鼠标移动时可见', value: 'on-move' },
            { label: '总是可见', value: 'always' },
            { label: '隐藏', value: 'hidden' },
          ]} />
        </div>
        <div className="ff-settings-layout-row ff-settings-layout-row--wide-select">
          <span>窗格</span>
          <OpenableSelect ariaLabel="窗格" defaultValue="on-move" storageKey="layout.paneButtons.mode" options={[
            { label: '鼠标移动时可见', value: 'on-move' },
            { label: '总是可见', value: 'always' },
            { label: '隐藏', value: 'hidden' },
          ]} />
        </div>
      </section>

      <section className="ff-settings-layout-group">
        <div className="ff-settings-layout-kicker">利润率</div>
        <div className="ff-settings-layout-row">
          <span>顶部</span>
          <SettingsTextInput ariaLabel="顶部利润率" defaultValue="10" storageKey="layout.margin.top" />
          <em>%</em>
        </div>
        <div className="ff-settings-layout-row">
          <span>底部</span>
          <SettingsTextInput ariaLabel="底部利润率" defaultValue="8" storageKey="layout.margin.bottom" />
          <em>%</em>
        </div>
        <div className="ff-settings-layout-row">
          <span>右</span>
          <SettingsTextInput ariaLabel="右侧利润率" defaultValue="10" storageKey="layout.margin.rightBars" />
          <em>根线</em>
        </div>
      </section>
    </div>
  )
}
