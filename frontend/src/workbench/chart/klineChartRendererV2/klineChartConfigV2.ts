export type KLineChartConfigV2 = {
  refreshRestore: {
    restoreLastPageOnRefresh: boolean
    restoreRealtimeEnabledOnRefresh: boolean
  }
  viewport: {
    anchorRealtimeBoundaryOnFrameLoad: boolean
    barSpaceMax: number
    barSpaceMin: number
    maxOffsetLeftDistance: number
    maxOffsetRightDistance: number
    restoreHorizontalViewportOnRefresh: boolean
    restoreYAxisRangeOnRefresh: boolean
    saveDelayMs: number
  }
  overlays: {
    pageBoundaryLabels: {
      labelMinVisibleWidth: number
      realtimeLabelGap: number
      startLabelInset: number
      stopLabelGap: number
    }
  }
}

export const kLineChartConfigV2 = {
  refreshRestore: {
    restoreLastPageOnRefresh: true,
    restoreRealtimeEnabledOnRefresh: true,
  },
  viewport: {
    anchorRealtimeBoundaryOnFrameLoad: false,
    barSpaceMax: 80,
    barSpaceMin: 1,
    maxOffsetLeftDistance: 1,
    maxOffsetRightDistance: 100_000,
    restoreHorizontalViewportOnRefresh: true,
    restoreYAxisRangeOnRefresh: true,
    saveDelayMs: 180,
  },
  overlays: {
    pageBoundaryLabels: {
      labelMinVisibleWidth: 48,
      realtimeLabelGap: 14,
      startLabelInset: 8,
      stopLabelGap: 10,
    },
  },
} as const satisfies KLineChartConfigV2
