import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND_URL = 'http://localhost:3002'
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOM_ROUTE_PATTERN = /^\/room\/[A-Za-z0-9_-]{6,64}\/?$/

// https://vite.dev/config/
export default defineConfig({
  appType: 'spa',
  plugins: [react(), roomRouteFallback()],
  server: {
    proxy: {
      '/health': BACKEND_URL,
      '/socket.io': {
        target: BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

function roomRouteFallback() {
  return {
    name: 'room-route-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] || ''

        if (req.method !== 'GET' || !ROOM_ROUTE_PATTERN.test(pathname)) {
          next()
          return
        }

        try {
          const indexHtml = await readFile(resolve(CURRENT_DIR, 'index.html'), 'utf8')
          const html = await server.transformIndexHtml(req.url, indexHtml)

          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
