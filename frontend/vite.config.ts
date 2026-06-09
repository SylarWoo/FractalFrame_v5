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

function persistentDevStatePlugin(): Plugin {
  const resolveStore = createWorkbenchProfileStoreResolver({
    fallbackStateFile: path.resolve(__dirname, '.fractalframe-dev', 'persistent-state.json'),
    stateFileName: 'workbench-profile.json',
  })

  return {
    name: 'fractalframe-persistent-dev-state',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__fractalframe_persistent_state', (req: IncomingMessage, res: ServerResponse) => {
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
              const payload = JSON.parse(body) as { key?: string; merge?: Record<string, unknown>; remove?: boolean; value?: unknown }
              if (!payload.key) throw new Error('Missing key')
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
  plugins: [react(), persistentDevStatePlugin(), chartViewportDevStatePlugin()],
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
