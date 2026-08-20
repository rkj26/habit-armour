import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Backend port is configurable so the dev server can run alongside whatever
// else is already holding 3000.  PORT=3010 npm run dev
const backend = `http://localhost:${process.env.PORT || 3000}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: {
      '/api': backend,
      '/uploads': backend,
    },
  },
})
