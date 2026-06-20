import { DrawingPriceCoordsPanel } from '../DrawingCoordsPanel'
import type { DrawingTool, SelectedDrawingState } from '../drawingTools/drawingTypes'

type DrawingCoordsTool = Pick<DrawingTool, 'key'>
type DrawingCoordsSelection = Pick<SelectedDrawingState, 'locked' | 'price' | 'tool' | 'trendPointPrices'>

export function DrawingCoordsPanel({
  onPriceChange,
  onTrendPointPriceChange,
  selectedDrawing,
  tool,
}: {
  onPriceChange: (price: number) => void
  onTrendPointPriceChange: (pointIndex: number, price: number) => void
  selectedDrawing: DrawingCoordsSelection | null
  tool: DrawingCoordsTool
}) {
  if (tool.key === 'horizontalLine') {
    return (
      <HorizontalLineCoordsPanel
        locked={selectedDrawing?.tool === 'horizontalLine' && selectedDrawing.locked}
        onPriceChange={onPriceChange}
        price={selectedDrawing?.tool === 'horizontalLine' ? selectedDrawing.price : undefined}
        selected={selectedDrawing?.tool === 'horizontalLine'}
      />
    )
  }
  if (tool.key === 'trendLine') {
    return (
      <TwoPointPriceCoordsPanel
        locked={selectedDrawing?.tool === 'trendLine' && selectedDrawing.locked}
        lockedMessage={'\u5f53\u524d\u9009\u4e2d\u7684\u8d8b\u52bf\u7ebf\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}
        notSelectedMessage={'\u672a\u9009\u4e2d\u8d8b\u52bf\u7ebf\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u6761\u8d8b\u52bf\u7ebf\u3002'}
        onPointPriceChange={onTrendPointPriceChange}
        pointPrices={selectedDrawing?.tool === 'trendLine' ? selectedDrawing.trendPointPrices : undefined}
        selected={selectedDrawing?.tool === 'trendLine'}
      />
    )
  }
  if (tool.key === 'ruler' || tool.key === 'fibRetracement') {
    const isFib = tool.key === 'fibRetracement'
    return (
      <TwoPointPriceCoordsPanel
        locked={selectedDrawing?.tool === tool.key && selectedDrawing.locked}
        lockedMessage={isFib ? '\u5f53\u524d\u9009\u4e2d\u7684\u6590\u6ce2\u90a3\u5951\u56de\u64a4\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002' : '\u5f53\u524d\u9009\u4e2d\u7684\u6807\u5c3a\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}
        notSelectedMessage={isFib ? '\u672a\u9009\u4e2d\u6590\u6ce2\u90a3\u5951\u56de\u64a4\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u4e2a\u6590\u6ce2\u90a3\u5951\u56de\u64a4\u3002' : '\u672a\u9009\u4e2d\u6807\u5c3a\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u4e2a\u6807\u5c3a\u3002'}
        onPointPriceChange={onTrendPointPriceChange}
        pointPrices={selectedDrawing?.tool === tool.key ? selectedDrawing.trendPointPrices : undefined}
        selected={selectedDrawing?.tool === tool.key}
      />
    )
  }
  const twoPoint = true
  return (
    <div className="ff-drawing-tline-coords-v1">
      <CoordinateRow label={twoPoint ? '1' : '\u4ef7\u683c'} />
      {twoPoint ? <CoordinateRow label="2" /> : null}
    </div>
  )
}

function HorizontalLineCoordsPanel({
  locked,
  onPriceChange,
  price,
  selected,
}: {
  locked: boolean
  onPriceChange: (price: number) => void
  price?: number
  selected: boolean
}) {
  return (
    <DrawingPriceCoordsPanel
      coordinates={[{
        id: 'ff-drawing-hline-coords-price-v1',
        label: '#1\uff08\u4ef7\u683c\uff09',
        onChange: onPriceChange,
        price,
      }]}
      locked={locked}
      lockedMessage={'\u5f53\u524d\u9009\u4e2d\u7684\u6c34\u5e73\u7ebf\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}
      notSelectedMessage={'\u672a\u9009\u4e2d\u6c34\u5e73\u7ebf\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u6761\u6c34\u5e73\u7ebf\uff0c\u518d\u5728\u6b64\u4fee\u6539\u4ef7\u683c\u5750\u6807\u3002'}
      selected={selected}
    />
  )
}

function CoordinateRow({ label }: { label: string }) {
  return (
    <div className="ff-drawing-tline-coords-v1__row">
      <span className="ff-drawing-tline-coords-v1__label">{label}</span>
      <input className="ff-drawing-tline-coords-v1__input" type="text" />
      <input className="ff-drawing-tline-coords-v1__input" type="text" />
    </div>
  )
}

function TwoPointPriceCoordsPanel({
  locked,
  lockedMessage,
  notSelectedMessage,
  onPointPriceChange,
  pointPrices,
  selected,
}: {
  locked: boolean
  lockedMessage: string
  notSelectedMessage: string
  onPointPriceChange: (pointIndex: number, price: number) => void
  pointPrices?: [number | undefined, number | undefined]
  selected: boolean
}) {
  return (
    <DrawingPriceCoordsPanel
      coordinates={[
        {
          id: 'ff-drawing-tline-price-1-v1',
          label: '#1\uff08\u4ef7\u683c\uff09',
          onChange: (price) => onPointPriceChange(0, price),
          price: pointPrices?.[0],
        },
        {
          id: 'ff-drawing-tline-price-2-v1',
          label: '#2\uff08\u4ef7\u683c\uff09',
          onChange: (price) => onPointPriceChange(1, price),
          price: pointPrices?.[1],
        },
      ]}
      locked={locked}
      lockedMessage={lockedMessage}
      notSelectedMessage={notSelectedMessage}
      selected={selected}
    />
  )
}
