import { DrawingToolSettingsContent } from './drawings'
import { DrawingToolHeader } from './DrawingToolControls'
import { useDrawingsDrawerController } from './drawingTools/useDrawingsDrawerController'
import './IndicatorSettingsShellLayout.css'
import './drawings/styles/DrawingsDrawer.css'

export function DrawingsDrawer({ chartPeriod }: { chartPeriod: string }) {
  const {
    handleSplitPointerDown,
    selectTool,
    selectedKey,
    selectedObjectId,
    selectedTool,
    toolSettingsProps,
    tools,
    topHeight,
  } = useDrawingsDrawerController(chartPeriod)

  return (
    <section className="ff-drawings-drawer" data-right-widget-panel="drawings" data-testid="ff-drawing-drawer-panel">
      <div className="ff-indicators-split-v1 ff-drawings-split-v1" data-ff-drawing-tools-split-v1 style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}>
        <div className="ff-indicators-split-v1__top" data-ff-drawing-tools-split-top-v1>
          <table className="right-widget-drawer__table ff-indicators-table-v1 ff-drawing-tools-table-v1" aria-label="Drawing tools">
            <colgroup>
              <col style={{ width: '100%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{'\u5de5\u5177'}</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr
                  aria-selected={selectedKey === tool.key}
                  data-ff-drawing-tool-row-v1={tool.key}
                  data-selected={selectedKey === tool.key ? 'true' : 'false'}
                  key={tool.key}
                  onClick={() => selectTool(tool.key)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    selectTool(tool.key)
                  }}
                  tabIndex={0}
                >
                  <td>{tool.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          aria-label="Resize drawing tools drawer split"
          className="ff-indicators-split-v1__handle"
          data-ff-drawing-tools-split-handle-v1="true"
          onPointerDown={handleSplitPointerDown}
          title="\u4e0a\u4e0b\u62d6\u52a8\u8c03\u6574\u7a97\u53e3\u5927\u5c0f"
          type="button"
        />
        <div className="ff-indicators-split-v1__bottom" data-ff-drawing-tools-split-bottom-v1>
          <DrawingToolHeader objectId={selectedObjectId} toolLabel={selectedTool.label} />
          <DrawingToolSettingsContent {...toolSettingsProps} />
        </div>
      </div>
    </section>
  )
}
