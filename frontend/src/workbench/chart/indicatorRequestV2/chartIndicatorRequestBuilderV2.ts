import { readPersistedIndicatorsState, type PersistedIndicatorsState } from '../../rightDrawer/indicatorPersistence'
import type { MmfStochH2PassthroughPeriod } from '../../rightDrawer/indicatorSettingsSchema'
import { storeV6AoIndicatorIdV2 } from './aoIndicatorV2'
import { storeV6DpoIndicatorIdV2 } from './dpoIndicatorV2'
import type { StoreV6IndicatorRequestSpecV2 } from './indicatorRequestTypes'
import { storeV6MaIndicatorIdV2 } from './maIndicatorV2'
import { storeV6MacdIndicatorIdV2 } from './macdIndicatorV2'
import { storeV6MmadIndicatorIdV2 } from './mmadIndicatorV2'
import { storeV6MmfV3IndicatorIdV2 } from './mmfV3IndicatorV2'
import { storeV6MmfStochH2IndicatorIdV2 } from './mmfStochH2IndicatorV2'
import {
  storeV6MorganRangeH2RequestIdV2,
  storeV6MorganRangeM5RequestIdV2,
  storeV6MorganRangeM30RequestIdV2,
} from './morganRangeIndicatorV2'
import { storeV6RsiIndicatorIdV2 } from './rsiIndicatorV2'
import { storeV6SqzmomIndicatorIdV2 } from './sqzmomIndicatorV2'
import { storeV6StochIndicatorIdV2 } from './stochIndicatorV2'
import { storeV6TsiIndicatorIdV2 } from './tsiIndicatorV2'
import { storeV6VdoIndicatorIdV2 } from './vdoIndicatorV2'
import { storeV6ViIndicatorIdV2 } from './viIndicatorV2'
import { storeV6VmiIndicatorIdV2 } from './vmiIndicatorV2'
import { storeV6VolIndicatorIdV2 } from './volIndicatorV2'
import { storeV6VwapIndicatorIdV2 } from './vwapIndicatorV2'

function isMmfStochH2PassthroughPeriod(period: string): period is MmfStochH2PassthroughPeriod {
  return period === 'M5' || period === 'M30' || period === 'H2'
}

export function buildChartIndicatorRequestsV2(options: {
  loadedIndicatorKeys: string[]
  period: string
  settings: PersistedIndicatorsState
}): StoreV6IndicatorRequestSpecV2[] {
  const requests: StoreV6IndicatorRequestSpecV2[] = []
  const loaded = new Set(options.loadedIndicatorKeys)
  const settings = options.settings
  const normalizedChartPeriod = options.period.trim().toUpperCase()
  const h2SourceSettings = normalizedChartPeriod === 'H2' ? settings : readPersistedIndicatorsState('H2')
  const h2ControlsCurrentPeriod = isMmfStochH2PassthroughPeriod(normalizedChartPeriod)
    && h2SourceSettings.mmfStochH2.passthroughVisible
    && h2SourceSettings.mmfStochH2.passthroughPeriods.includes(normalizedChartPeriod)
  const mmfStochH2SourceSettings = h2SourceSettings.loaded.MMF_STOCH_H2 === true || h2ControlsCurrentPeriod
    ? h2SourceSettings.mmfStochH2
    : settings.mmfStochH2
  const mmfStochH2SourceLoaded = loaded.has('MMF_STOCH_H2')
    || h2SourceSettings.loaded.MMF_STOCH_H2 === true
    || (normalizedChartPeriod !== 'H2' && h2ControlsCurrentPeriod)
  const currentPeriodMorganRangeRequestId = normalizedChartPeriod === 'M30'
    ? storeV6MorganRangeM30RequestIdV2
    : normalizedChartPeriod === 'H2'
      ? storeV6MorganRangeH2RequestIdV2
    : normalizedChartPeriod === 'M5'
      ? storeV6MorganRangeM5RequestIdV2
      : null
  const currentPeriodMorganRangeLoaded = normalizedChartPeriod === 'M30'
    ? loaded.has('MR-M30')
    : normalizedChartPeriod === 'H2'
      ? loaded.has('MR-H2')
    : normalizedChartPeriod === 'M5'
      ? loaded.has('MR-M5')
      : false

  if (loaded.has('MA')) {
    requests.push({
      id: storeV6MaIndicatorIdV2,
      params: settings.ma,
    })
  }
  if (loaded.has('MMF_V3')) {
    requests.push({
      id: storeV6MmfV3IndicatorIdV2,
      params: {
        maSettings: settings.ma,
        morganRangeMode: normalizedChartPeriod === 'H2' && loaded.has('MR-H2')
          ? 'D5_H2'
          : normalizedChartPeriod === 'M30' && loaded.has('MR-M30')
            ? 'D1_M30'
            : 'H4_M5',
        settings: settings.mmfV3,
        stochSettings: settings.stoch,
        tsiSettings: settings.tsi,
        vdoSettings: settings.vdo,
        vmiSettings: settings.vmi,
        vwapSettings: settings.vwap,
      },
    })
  }
  if (
    mmfStochH2SourceLoaded
    && isMmfStochH2PassthroughPeriod(normalizedChartPeriod)
    && mmfStochH2SourceSettings.passthroughVisible
    && mmfStochH2SourceSettings.passthroughPeriods.includes(normalizedChartPeriod)
  ) {
    requests.push({
      id: storeV6MmfStochH2IndicatorIdV2,
      params: {
        settings: mmfStochH2SourceSettings,
        stochSettings: settings.stoch,
        targetPeriod: normalizedChartPeriod,
      },
    })
  }
  if (currentPeriodMorganRangeLoaded && currentPeriodMorganRangeRequestId) {
    const currentPeriodMorganRangeSettings = normalizedChartPeriod === 'H2'
      ? settings.mrH2
      : normalizedChartPeriod === 'M30'
        ? settings.mrM30
        : settings.mr
    requests.push({
      id: currentPeriodMorganRangeRequestId,
      params: currentPeriodMorganRangeSettings,
    })
  }
  if (loaded.has('Vol')) {
    requests.push({
      id: storeV6VolIndicatorIdV2,
      params: settings.vol,
    })
  }
  if (loaded.has('VWAP')) {
    requests.push({
      id: storeV6VwapIndicatorIdV2,
      params: settings.vwap,
    })
  }
  if (loaded.has('RSI')) {
    requests.push({
      id: storeV6RsiIndicatorIdV2,
      params: settings.rsi,
    })
  }
  if (loaded.has('SQZMOM')) {
    requests.push({
      id: storeV6SqzmomIndicatorIdV2,
      params: settings.sqzmom,
    })
  }
  if (loaded.has('MACD')) {
    requests.push({
      id: storeV6MacdIndicatorIdV2,
      params: settings.macd,
    })
  }
  if (loaded.has('DPO')) {
    requests.push({
      id: storeV6DpoIndicatorIdV2,
      params: settings.dpo,
    })
  }
  if (loaded.has('Stoch')) {
    requests.push({
      id: storeV6StochIndicatorIdV2,
      params: settings.stoch,
    })
  }
  if (loaded.has('TSI')) {
    requests.push({
      id: storeV6TsiIndicatorIdV2,
      params: settings.tsi,
    })
  }
  if (loaded.has('AO')) {
    requests.push({
      id: storeV6AoIndicatorIdV2,
      params: settings.ao,
    })
  }
  if (loaded.has('VDO')) {
    requests.push({
      id: storeV6VdoIndicatorIdV2,
      params: settings.vdo,
    })
  }
  if (loaded.has('VMI')) {
    requests.push({
      id: storeV6VmiIndicatorIdV2,
      params: settings.vmi,
    })
  }
  if (loaded.has('MMAD')) {
    requests.push({
      id: storeV6MmadIndicatorIdV2,
      params: settings.mmad,
    })
  }
  if (loaded.has('VI')) {
    requests.push({
      id: storeV6ViIndicatorIdV2,
      params: settings.vi,
    })
  }
  return requests
}
