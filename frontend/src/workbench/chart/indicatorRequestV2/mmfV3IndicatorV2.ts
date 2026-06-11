import {
  normalizeMmfSettings,
  type MaIndicatorSettings,
  type MmfIndicatorSettings,
  type StochIndicatorSettings,
  type TsiIndicatorSettings,
  type VdoIndicatorSettings,
  type VmiIndicatorSettings,
  type VwapIndicatorSettings,
} from '../../rightDrawer/indicatorSettingsSchema'
import type { MmfV3CalcContext, MmfV3IndicatorRow } from '../mmfV3Types'
import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'
import {
  calculateMmfV3FrontendRowsForDisplayPageV2,
  normalizeMmfV3FrontendContextV2,
  requiredMmfV3FrontendWarmupRowsV2,
} from './mmfV3FrontendEngineV2'

export const storeV6MmfV3IndicatorIdV2 = 'MMF_V3'
export const storeV6MmfV3PaneIdV2 = 'candle_pane'

export type StoreV6MmfV3IndicatorParamsV2 = Partial<MmfV3CalcContext> & {
  settings?: Partial<MmfIndicatorSettings>
}

export type StoreV6MmfV3IndicatorRowV2 = MmfV3IndicatorRow & {
  barKey: string
  globalIndex: number | null
  time: number
  timestamp: number
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRequestContext(
  request: StoreV6IndicatorRequestSpecV2<StoreV6MmfV3IndicatorParamsV2>,
  symbol: string,
  period: string,
): MmfV3CalcContext {
  const params = request.params ?? {}
  return {
    maSettings: params.maSettings as Partial<MaIndicatorSettings> | undefined,
    morganRangeMode: params.morganRangeMode === 'D5_H2' ? 'D5_H2' : params.morganRangeMode === 'D1_M30' ? 'D1_M30' : 'H4_M5',
    period,
    settings: normalizeMmfSettings(params.settings as Partial<MmfIndicatorSettings> | undefined),
    stochSettings: params.stochSettings as Partial<StochIndicatorSettings> | undefined,
    symbol,
    tsiSettings: params.tsiSettings as Partial<TsiIndicatorSettings> | undefined,
    vdoSettings: params.vdoSettings as Partial<VdoIndicatorSettings> | undefined,
    vmiSettings: params.vmiSettings as Partial<VmiIndicatorSettings> | undefined,
    vwapSettings: params.vwapSettings as Partial<VwapIndicatorSettings> | undefined,
  }
}

function attachDisplayMetadata(
  displayRows: Array<{ barKey: string; globalIndex?: number | null; time?: unknown; timestamp?: unknown }>,
  indicatorRows: MmfV3IndicatorRow[],
): StoreV6MmfV3IndicatorRowV2[] {
  return displayRows.map((row, index) => ({
    ...(indicatorRows[index] ?? {}),
    barKey: row.barKey,
    globalIndex: row.globalIndex ?? null,
    time: finiteNumber(row.time),
    timestamp: finiteNumber(row.timestamp),
  }))
}

export const storeV6MmfV3IndicatorDefinitionV2: StoreV6IndicatorDefinitionV2<StoreV6MmfV3IndicatorParamsV2> = {
  calculationMode: 'computed',
  calculateHistory: (context) => {
    const inputContext = normalizeRequestContext(context.request, context.symbol, context.period)
    const settings = normalizeMmfV3FrontendContextV2(inputContext)
    const rows = attachDisplayMetadata(
      context.displayRows,
      calculateMmfV3FrontendRowsForDisplayPageV2({
        calculationRows: context.calculationRows,
        displayRows: context.displayRows,
        inputContext,
      }),
    )
    return {
      [storeV6MmfV3IndicatorIdV2]: {
        displayRows: rows,
        key: `${storeV6MmfV3IndicatorIdV2}:history:${context.symbol}:${context.period}:${context.pageIndex}:frontend-v2`,
        rows,
        settings,
        source: 'store-v6-mmf-v3-frontend-engine-v2',
      },
    }
  },
  calculateRealtime: (context) => {
    const inputContext = normalizeRequestContext(context.request, context.symbol, context.period)
    const settings = normalizeMmfV3FrontendContextV2(inputContext)
    const calculationRows = [...context.historyRows, ...context.activeRows]
    const rows = attachDisplayMetadata(
      context.activeRows,
      calculateMmfV3FrontendRowsForDisplayPageV2({
        calculationRows,
        displayRows: context.activeRows,
        inputContext,
      }),
    )
    return {
      [storeV6MmfV3IndicatorIdV2]: {
        displayRows: rows,
        key: `${storeV6MmfV3IndicatorIdV2}:realtime:${context.symbol}:${context.period}:${context.sessionTimeFrom ?? 'none'}:frontend-v2`,
        rows,
        settings,
        source: 'store-v6-mmf-v3-frontend-engine-v2',
      },
    }
  },
  id: storeV6MmfV3IndicatorIdV2,
  paneId: storeV6MmfV3PaneIdV2,
  paneRole: 'main',
  realtimeUpdateMode: 'deferred',
  renderRole: 'main-overlay',
  warmup: {
    historyRows: (request) => requiredMmfV3FrontendWarmupRowsV2(request.params ?? {}),
    mode: 'fixedRows',
    realtimeRows: (request) => requiredMmfV3FrontendWarmupRowsV2(request.params ?? {}),
  },
}
