import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Lets `npm run dev` talk to the Go backend (localhost:8080) same-origin,
    // matching the nginx proxy used in docker-compose (see nginx.conf) —
    // the backend has no CORS headers, so a direct cross-origin fetch would fail.
    proxy: {
      '/query': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
