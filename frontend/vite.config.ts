import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies API + SignalR + health to the .NET backend on :5080,
// so the SPA can call same-origin paths in dev and prod alike.
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
      '/hubs': { target: 'http://localhost:5080', changeOrigin: true, ws: true },
      '/health': { target: 'http://localhost:5080', changeOrigin: true },
    },
  },
})
