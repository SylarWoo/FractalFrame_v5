type PageProbePayload = Record<string, unknown>

type PageProbeEvent = {
  at: string
  event: string
  payload: PageProbePayload
}

declare global {
  interface Window {
    __ffPageProbe?: {
      events: PageProbeEvent[]
      clear: () => void
    }
  }
}

const maxEvents = 250

function enabled() {
  return import.meta.env.DEV
}

function ensureProbe() {
  if (!enabled() || typeof window === 'undefined') return null
  if (!window.__ffPageProbe) {
    window.__ffPageProbe = {
      events: [],
      clear() {
        this.events.length = 0
      },
    }
  }
  return window.__ffPageProbe
}

export function traceKLineChartPageV2(event: string, payload: PageProbePayload = {}) {
  const probe = ensureProbe()
  if (!probe) return
  const entry = {
    at: new Date().toISOString(),
    event,
    payload,
  }
  probe.events.push(entry)
  if (probe.events.length > maxEvents) probe.events.splice(0, probe.events.length - maxEvents)
  console.debug(`[ff-page] ${event}`, payload)
}

