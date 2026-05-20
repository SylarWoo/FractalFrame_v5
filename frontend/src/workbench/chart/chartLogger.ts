export const chartDebugEnabled = import.meta.env.DEV

export function chartInfo(...args: unknown[]) {
  if (chartDebugEnabled) {
    console.info(...args)
  }
}

export function chartWarn(...args: unknown[]) {
  console.warn(...args)
}

export function chartError(...args: unknown[]) {
  console.error(...args)
}
