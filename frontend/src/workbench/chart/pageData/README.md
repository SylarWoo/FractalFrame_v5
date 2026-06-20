# Page Data Boundary

`pageData/` is a shared V2 data preparation layer. It owns:

- page data package types and cache
- page data keys and normalized bar rows
- StoreV6-backed page data slice loading
- page indicator table calculation

It should not own legacy page/window behavior. Legacy adapters that turn static
display rows into old `ChartPageWindow` objects belong in `../legacy/pageWindow/`.

If a new feature needs history or realtime window assembly, prefer the V2
modules in `historyPageWindowV2/`, `realtimePageWindowV2/`, and
`klineChartRenderFrameV2/`.
