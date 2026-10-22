import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Proxy API traffic through Vite.
 *
 * This keeps local development same-origin, and lets a single HTTPS tunnel
 * (for example localtunnel) serve both the app and the PHP API on a phone.
 */
const API_PROXY = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow common HTTPS tunnel hosts during phone/PWA testing. Vite only
    // accepts localhost and IP hosts by default.
    allowedHosts: [
      '.loca.lt',
      '.trycloudflare.com',
      '.lhr.life',
      '.pinggy-free.link',
      '.free.pinggy.net',
    ],
    proxy: API_PROXY,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: [
      '.loca.lt',
      '.trycloudflare.com',
      '.lhr.life',
      '.pinggy-free.link',
      '.free.pinggy.net',
    ],
    proxy: API_PROXY,
  },
})
