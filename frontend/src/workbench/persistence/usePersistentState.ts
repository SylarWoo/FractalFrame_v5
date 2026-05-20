import { useEffect, useState } from 'react'
import { readJson, writeJson } from './jsonStorage'

export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readJson(key, fallback))

  useEffect(() => {
    writeJson(key, value)
  }, [key, value])

  return [value, setValue] as const
}
