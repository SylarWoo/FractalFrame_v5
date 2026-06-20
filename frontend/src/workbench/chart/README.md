# Chart Runtime Map

This directory is split between the active KLineChart V2 runtime, shared chart
modules, and the isolated legacy host.

## V2 Runtime

- Main entry: `ChartWorkspaceV2.tsx`
- KLineChart host and renderer: `klineChartRendererV2/`
- Render frame assembly: `klineChartRenderFrameV2/`
- History page window: `historyPageWindowV2/`
- Realtime page window: `realtimePageWindowV2/`
- Indicator requests and runtime: `indicatorRequestV2/`
- Page slicing and partitioning: `pageSliceV2/`, `pagePartition/`

New chart behavior should be added to the V2 runtime unless it is explicitly a
legacy compatibility fix.

V2 owns these runtime lifecycles:

- Frame application, tail updates, viewport restore, and page-jump anchoring are
  centralized in `klineChartRendererV2/klineChartFrameApplyControllerV2.ts`.
- Main and sub-pane indicator mounting is centralized in
  `klineChartRendererV2/klineChartIndicatorLifecycleV2.ts`.
- V2 mouse behavior is installed from
  `klineChartRendererV2/klineChartMouseEventControllerV2.ts`; drawing-specific
  cursor behavior is isolated in `klineChartDrawingMouseEventsV2.ts`.
- Drawing tools enter V2 through `chartDrawingModule.ts`. V2 should not import
  `chartMouseBehaviorOverrides.ts` or legacy chart instance hooks.

Performance rules for V2:

- Realtime/tail movement should use `updateData` when the render window is
  unchanged, not `applyNewData`.
- A full frame apply should run overlay lifecycles once after KLineChart data is
  ready. Do not add an immediate second `overlayController.updateFrame` after the
  ready callback.
- Indicator-only frame changes should use pane-only updates and avoid scanning
  every kline row when the main data identity is unchanged.

## Shared Modules

- `chartRuntimeTypes.ts` contains runtime types shared by V2 and legacy code.
- `pageData/` owns page data packages, page data cache, page data keys, page
  indicator calculation, and page calculation context integration.
- `chartRealtimeBridge.ts` is the shared realtime event and tail-row bridge used
  by V2, realtime price markers, and workbench monitors.
- `chartCoreDataUtils.ts` is still used by V2 page slice readers and should not
  be moved into `legacy/` while those imports remain.

## Legacy Runtime

`legacy/` contains hooks and page/window adapters for the old chart host
runtime. `LegacyChartCoreHost.tsx` remains as a compatibility shell while the
old runtime is still kept compiling, but do not add new V2 behavior there.

`realtimePageBuffer.ts` remains only as a compatibility re-export for legacy
imports. V2 code should import realtime buffer helpers from
`chartRealtimeBridge.ts`.
