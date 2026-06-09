export type ChartRafTaskPriorityV2 = 'critical' | 'overlay' | 'indicator' | 'debug'

type ScheduledTaskV2 = {
  callback: () => void
  frameId: number
  priority: ChartRafTaskPriorityV2
}

const priorityOrder: Record<ChartRafTaskPriorityV2, number> = {
  critical: 0,
  overlay: 1,
  indicator: 2,
  debug: 3,
}

export function createChartRafSchedulerV2() {
  const tasks = new Map<string, ScheduledTaskV2>()

  function cancel(key: string) {
    const existing = tasks.get(key)
    if (!existing) return
    window.cancelAnimationFrame(existing.frameId)
    tasks.delete(key)
  }

  function schedule(key: string, callback: () => void, options: {
    priority?: ChartRafTaskPriorityV2
    replaceLatest?: boolean
    runAfterDragEnd?: boolean
  } = {}) {
    const priority = options.priority ?? 'overlay'
    const existing = tasks.get(key)
    if (existing && !options.replaceLatest && priorityOrder[existing.priority] <= priorityOrder[priority]) return
    if (existing) cancel(key)
    const run = () => {
      tasks.delete(key)
      callback()
    }
    if (options.runAfterDragEnd && window.__ffKLineChartV2Interaction?.horizontalDragInProgress === true) {
      const onDragEnd = () => {
        window.removeEventListener('fractalframe:klineChartHorizontalDragEnd', onDragEnd)
        schedule(key, callback, { ...options, runAfterDragEnd: false })
      }
      window.addEventListener('fractalframe:klineChartHorizontalDragEnd', onDragEnd, { once: true })
      return
    }
    const frameId = window.requestAnimationFrame(run)
    tasks.set(key, { callback, frameId, priority })
  }

  return {
    cancel,
    destroy() {
      for (const key of [...tasks.keys()]) cancel(key)
    },
    schedule,
  }
}
