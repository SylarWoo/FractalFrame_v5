import type { StoreV6IndicatorDefinitionV2, StoreV6IndicatorRegistryV2 } from './indicatorRequestTypes'

function normalizeIndicatorId(id: string) {
  return id.trim().toUpperCase()
}

export function createStoreV6IndicatorRegistryV2(): StoreV6IndicatorRegistryV2 {
  const definitions = new Map<string, StoreV6IndicatorDefinitionV2>()
  return {
    clear: () => definitions.clear(),
    get: (id) => definitions.get(normalizeIndicatorId(id)) ?? null,
    list: () => [...definitions.values()],
    register: (definition) => {
      const id = normalizeIndicatorId(definition.id)
      if (!id) throw new Error('StoreV6 indicator definition id is required.')
      definitions.set(id, {
        ...definition,
        id,
      })
    },
  }
}

export const storeV6IndicatorRegistryV2 = createStoreV6IndicatorRegistryV2()
