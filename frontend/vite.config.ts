import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createJsonStateStore(stateFile: string, fallbackStateFile?: string) {
  function readState(): Record<string, unknown> {
    try {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as Record<string, unknown>
    } catch {
      if (!fallbackStateFile) return {}
      try {
        return JSON.parse(fs.readFileSync(fallbackStateFile, 'utf8')) as Record<string, unknown>
      } catch {
        return {}
      }
    }
  }

  function writeState(state: Record<string, unknown>) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true })
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8')
  }

  return { readState, writeState }
}

function sanitizeProfileId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'default'
}

function resolveRequestPort(req: IncomingMessage, server: ViteDevServer) {
  const host = typeof req.headers.host === 'string' ? req.headers.host : ''
  const hostPort = host.includes(':') ? host.split(':').pop() : ''
  if (hostPort && /^\d+$/.test(hostPort)) return hostPort
  const configuredPort = server.config.server.port
  return typeof configuredPort === 'number' && Number.isFinite(configuredPort) ? String(configuredPort) : 'default'
}

function resolveWorkbenchProfileId(req: IncomingMessage, server: ViteDevServer) {
  return sanitizeProfileId(`port-${resolveRequestPort(req, server)}`)
}

function createWorkbenchProfileStoreResolver(options: {
  fallbackStateFile?: string
  stateFileName: string
}) {
  const stores = new Map<string, ReturnType<typeof createJsonStateStore>>()
  return (profileId: string) => {
    const cached = stores.get(profileId)
    if (cached) return cached
    const stateFile = path.resolve(__dirname, '.fractalframe-dev', 'profiles', profileId, options.stateFileName)
    const store = createJsonStateStore(stateFile, options.fallbackStateFile)
    stores.set(profileId, store)
    return store
  }
}

const sharedPersistentStateKeys = new Set([
  'fractalframe.drawings.horizontalLine.items',
  'fractalframe.drawings.trendLine.items',
  'fractalframe.drawingsDrawer.fibRetracementStyle',
])

function sanitizeRealtimePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/-+/g, '-') || 'unknown'
}

function resolveRealtimeStateFile(options: {
  kind: string
  period: string
  profileId: string
  sessionTimeFrom: string
  sessionTimeTo: string
  symbol: string
}) {
  const kind = options.kind === 'tail' ? 'tail' : 'stable'
  const symbol = sanitizeRealtimePathSegment(options.symbol)
  const period = sanitizeRealtimePathSegment(options.period.toUpperCase())
  const from = sanitizeRealtimePathSegment(options.sessionTimeFrom)
  const to = sanitizeRealtimePathSegment(options.sessionTimeTo || 'open')
  return path.resolve(
    __dirname,
    '.fractalframe-dev',
    'profiles',
    options.profileId,
    'realtime-pages',
    symbol,
    period,
    `${kind}-${from}-${to}.json`,
  )
}

function clearRealtimeStateFiles(options: {
  kind?: string | null
  period?: string | null
  profileId: string
  symbol?: string | null
}) {
  const root = path.resolve(__dirname, '.fractalframe-dev', 'profiles', options.profileId, 'realtime-pages')
  const symbol = options.symbol ? sanitizeRealtimePathSegment(options.symbol) : null
  const period = options.period ? sanitizeRealtimePathSegment(options.period.toUpperCase()) : null
  const target = symbol && period
    ? path.join(root, symbol, period)
    : symbol
      ? path.join(root, symbol)
      : root
  if (!target.startsWith(root)) return
  const kind = options.kind === 'tail' ? 'tail' : options.kind === 'stable' ? 'stable' : null
  if (kind && fs.existsSync(target)) {
    for (const fileName of fs.readdirSync(target)) {
      if (fileName.startsWith(`${kind}-`) && fileName.endsWith('.json')) {
        fs.rmSync(path.join(target, fileName), { force: true })
      }
    }
    return
  }
  fs.rmSync(target, { force: true, recursive: true })
}

function realtimePageStatePlugin(): Plugin {
  return {
    name: 'fractalframe-realtime-page-state',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__fractalframe_realtime_page_state', (req: IncomingMessage, res: ServerResponse) => {
        if (!req.url) {
          res.statusCode = 400
          res.end()
          return
        }
        const requestUrl = new URL(req.url, 'http://127.0.0.1')
        const profileId = resolveWorkbenchProfileId(req, server)
        if (req.method === 'GET') {
          const kind = requestUrl.searchParams.get('kind') || ''
          const symbol = requestUrl.searchParams.get('symbol') || ''
          const period = requestUrl.searchParams.get('period') || ''
          const sessionTimeFrom = requestUrl.searchParams.get('sessionTimeFrom') || ''
          const sessionTimeTo = requestUrl.searchParams.get('sessionTimeTo') || 'open'
          if (!kind || !symbol || !period || !sessionTimeFrom) {
            res.statusCode = 400
            res.end(JSON.stringify({ value: null }))
            return
          }
          const stateFile = resolveRealtimeStateFile({ kind, period, profileId, sessionTimeFrom, sessionTimeTo, symbol })
          try {
            const value = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as unknown
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ value }))
          } catch {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ value: null }))
          }
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += String(chunk)
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as {
                kind?: string
                period?: string
                remove?: boolean
                sessionTimeFrom?: number | string | null
                sessionTimeTo?: number | string | null
                symbol?: string
                value?: unknown
              }
              if (payload.remove) {
                clearRealtimeStateFiles({ kind: payload.kind ?? null, period: payload.period ?? null, profileId, symbol: payload.symbol ?? null })
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
                return
              }
              if (!payload.kind || !payload.symbol || !payload.period || payload.sessionTimeFrom == null) {
                throw new Error('Missing realtime page identity')
              }
              clearRealtimeStateFiles({ kind: payload.kind, period: payload.period, profileId, symbol: payload.symbol })
              const stateFile = resolveRealtimeStateFile({
                kind: payload.kind,
                period: payload.period,
                profileId,
                sessionTimeFrom: String(payload.sessionTimeFrom),
                sessionTimeTo: payload.sessionTimeTo == null ? 'open' : String(payload.sessionTimeTo),
                symbol: payload.symbol,
              })
              fs.mkdirSync(path.dirname(stateFile), { recursive: true })
              fs.writeFileSync(stateFile, JSON.stringify(payload.value ?? null, null, 2), 'utf8')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false }))
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

function resolvePeriodUiStateFile(options: {
  kind: string
  period: string
  profileId: string
}) {
  const kind = options.kind === 'settings' ? 'settings' : 'indicators'
  const period = sanitizeRealtimePathSegment(options.period.toUpperCase())
  return path.resolve(
    __dirname,
    '.fractalframe-dev',
    'profiles',
    options.profileId,
    'period-state',
    period,
    `${kind}.json`,
  )
}

function isSharedPeriodUiState(options: {
  kind: string
  period: string
}) {
  return options.kind === 'indicators' && options.period.toUpperCase() === 'H2'
}

function resolveSharedPeriodUiStateFile(options: {
  kind: string
  period: string
}) {
  const kind = options.kind === 'settings' ? 'settings' : 'indicators'
  const period = sanitizeRealtimePathSegment(options.period.toUpperCase())
  return path.resolve(
    __dirname,
    '.fractalframe-dev',
    'shared-period-state',
    period,
    `${kind}.json`,
  )
}

function readJsonFileOrNull(stateFile: string) {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8')) as unknown
  } catch {
    return null
  }
}

function readLatestProfilePeriodUiStateOrNull(options: {
  kind: string
  period: string
}) {
  const kind = options.kind === 'settings' ? 'settings' : 'indicators'
  const period = sanitizeRealtimePathSegment(options.period.toUpperCase())
  const profilesDir = path.resolve(__dirname, '.fractalframe-dev', 'profiles')
  try {
    const candidates = fs.readdirSync(profilesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.resolve(profilesDir, entry.name, 'period-state', period, `${kind}.json`))
      .filter((stateFile) => fs.existsSync(stateFile))
      .map((stateFile) => ({
        mtimeMs: fs.statSync(stateFile).mtimeMs,
        stateFile,
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
    return candidates.length ? readJsonFileOrNull(candidates[0].stateFile) : null
  } catch {
    return null
  }
}

function periodUiStatePlugin(): Plugin {
  return {
    name: 'fractalframe-period-ui-state',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__fractalframe_period_ui_state', (req: IncomingMessage, res: ServerResponse) => {
        if (!req.url) {
          res.statusCode = 400
          res.end()
          return
        }
        const requestUrl = new URL(req.url, 'http://127.0.0.1')
        const profileId = resolveWorkbenchProfileId(req, server)
        if (req.method === 'GET') {
          const kind = requestUrl.searchParams.get('kind') || ''
          const period = requestUrl.searchParams.get('period') || ''
          if (!kind || !period) {
            res.statusCode = 400
            res.end(JSON.stringify({ value: null }))
            return
          }
          const stateFile = resolvePeriodUiStateFile({ kind, period, profileId })
          const sharedStateFile = isSharedPeriodUiState({ kind, period })
            ? resolveSharedPeriodUiStateFile({ kind, period })
            : null
          const value = readJsonFileOrNull(stateFile)
            ?? (sharedStateFile ? readJsonFileOrNull(sharedStateFile) : null)
            ?? (sharedStateFile ? readLatestProfilePeriodUiStateOrNull({ kind, period }) : null)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ value }))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += String(chunk)
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as {
                kind?: string
                period?: string
                remove?: boolean
                value?: unknown
              }
              if (!payload.kind || !payload.period) throw new Error('Missing period UI state identity')
              const stateFile = resolvePeriodUiStateFile({ kind: payload.kind, period: payload.period, profileId })
              const sharedStateFile = isSharedPeriodUiState({ kind: payload.kind, period: payload.period })
                ? resolveSharedPeriodUiStateFile({ kind: payload.kind, period: payload.period })
                : null
              if (payload.remove) {
                fs.rmSync(stateFile, { force: true })
                if (sharedStateFile) fs.rmSync(sharedStateFile, { force: true })
              } else {
                fs.mkdirSync(path.dirname(stateFile), { recursive: true })
                fs.writeFileSync(stateFile, JSON.stringify(payload.value ?? null, null, 2), 'utf8')
                if (sharedStateFile) {
                  fs.mkdirSync(path.dirname(sharedStateFile), { recursive: true })
                  fs.writeFileSync(sharedStateFile, JSON.stringify(payload.value ?? null, null, 2), 'utf8')
                }
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false }))
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

function persistentDevStatePlugin(): Plugin {
  const resolveStore = createWorkbenchProfileStoreResolver({
    fallbackStateFile: path.resolve(__dirname, '.fractalframe-dev', 'persistent-state.json'),
    stateFileName: 'workbench-profile.json',
  })
  const sharedStore = createJsonStateStore(path.resolve(__dirname, '.fractalframe-dev', 'shared-workbench-profile.json'))
  const sharedStateClients = new Set<ServerResponse>()
  const broadcastSharedStateChange = (key: string, origin?: string) => {
    const payload = `data: ${JSON.stringify({ key, origin })}\n\n`
    sharedStateClients.forEach((client) => {
      try {
        client.write(payload)
      } catch {
        sharedStateClients.delete(client)
      }
    })
  }

  return {
    name: 'fractalframe-persistent-dev-state',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__fractalframe_persistent_state_events', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end()
          return
        }
        res.writeHead(200, {
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Content-Type': 'text/event-stream',
        })
        res.write(': connected\n\n')
        sharedStateClients.add(res)
        req.on('close', () => {
          sharedStateClients.delete(res)
        })
      })
      server.middlewares.use('/__fractalframe_persistent_state', (req: IncomingMessage, res: ServerResponse) => {
        if (!req.url) {
          res.statusCode = 400
          res.end()
          return
        }
        const requestUrl = new URL(req.url, 'http://127.0.0.1')
        const profileId = resolveWorkbenchProfileId(req, server)
        if (req.method === 'GET') {
          const key = requestUrl.searchParams.get('key')
          const { readState } = key && sharedPersistentStateKeys.has(key) ? sharedStore : resolveStore(profileId)
          const state = readState()
          const value = key ? state[key] : null
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ value: value ?? null }))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += String(chunk)
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as { key?: string; merge?: Record<string, unknown>; origin?: string; remove?: boolean; value?: unknown }
              if (!payload.key) throw new Error('Missing key')
              const sharedKey = sharedPersistentStateKeys.has(payload.key)
              const { readState, writeState } = sharedKey ? sharedStore : resolveStore(profileId)
              const state = readState()
              if (payload.remove) {
                delete state[payload.key]
              } else if (payload.merge && typeof payload.merge === 'object' && !Array.isArray(payload.merge)) {
                const current = state[payload.key]
                state[payload.key] = {
                  ...(current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {}),
                  ...payload.merge,
                }
              } else {
                state[payload.key] = payload.value
              }
              writeState(state)
              if (sharedKey) broadcastSharedStateChange(payload.key, typeof payload.origin === 'string' ? payload.origin : undefined)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false }))
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

function chartViewportDevStatePlugin(): Plugin {
  const viewportStateKeyPrefixes = ['fractalframe:chartViewport:v4', 'fractalframe:chartViewport:v3']
  const resolveStore = createWorkbenchProfileStoreResolver({
    fallbackStateFile: path.resolve(__dirname, '.fractalframe-dev', 'chart-viewport-state-v4.json'),
    stateFileName: 'chart-viewport-state-v4.json',
  })
  const isSupportedViewportStateKey = (key: string) => viewportStateKeyPrefixes.some((prefix) => key.startsWith(prefix))

  return {
    name: 'fractalframe-chart-viewport-dev-state',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__fractalframe_chart_viewport_state', (req: IncomingMessage, res: ServerResponse) => {
        if (!req.url) {
          res.statusCode = 400
          res.end()
          return
        }
        const requestUrl = new URL(req.url, 'http://127.0.0.1')
        const profileId = resolveWorkbenchProfileId(req, server)
        const { readState, writeState } = resolveStore(profileId)
        if (req.method === 'GET') {
          const key = requestUrl.searchParams.get('key')
          if (key && !isSupportedViewportStateKey(key)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ value: null }))
            return
          }
          const value = key ? readState()[key] : null
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ value: value ?? null }))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => {
            body += String(chunk)
          })
          req.on('end', () => {
            try {
              const payload = JSON.parse(body) as { key?: string; value?: unknown }
              if (!payload.key) throw new Error('Missing key')
              if (!isSupportedViewportStateKey(payload.key)) throw new Error('Unsupported key')
              const state = readState()
              state[payload.key] = payload.value
              writeState(state)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false }))
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), persistentDevStatePlugin(), chartViewportDevStatePlugin(), realtimePageStatePlugin(), periodUiStatePlugin()],
  server: {
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom)[\\/]/,
              priority: 20,
            },
            {
              name: 'chart-vendor',
              test: /node_modules[\\/](@klinecharts|klinecharts)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
