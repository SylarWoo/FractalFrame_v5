# Legacy Chart Host Hooks

This folder contains hooks that belong to the old `LegacyChartCoreHost` runtime.

New KLineChart V2 work should use `ChartWorkspaceV2`, `klineChartRendererV2`,
`indicatorRequestV2`, and `realtimePageWindowV2` instead of importing from here.

Keep this folder compiling while the old host remains available, but do not add
new V2 behavior here.
