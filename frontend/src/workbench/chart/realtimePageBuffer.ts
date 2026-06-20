// Compatibility entry for the old LegacyChartCoreHost runtime.
// New V2 and workbench code should import from chartRealtimeBridge.ts.
export {
  clearRealtimePageBuffer,
  readRealtimePageBuffer,
  realtimePageBufferMaxRows,
  upsertRealtimePageBufferRow,
  writeRealtimePageBuffer,
} from './chartRealtimeBridge'
