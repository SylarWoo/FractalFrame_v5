import {
  hasStoreV6PeriodPageSystemV2,
  listStoreV6PeriodPageSystemPeriodsV2,
  normalizePageSystemPeriodV2,
} from './periodPageSystemRegistryV2'

export {
  hasStoreV6PeriodPageSystemV2,
  listStoreV6PeriodPageSystemPeriodsV2,
  normalizePageSystemPeriodV2,
}

export function unsupportedStoreV6PeriodPageSystemTextV2(period: string | null | undefined) {
  const normalized = normalizePageSystemPeriodV2(period) || '当前周期'
  return `${normalized} 暂未接入独立周期分页系统；接入该周期分页器后才能更新分页和打开图表。`
}
