import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    open: true,
    port: 3000,
  },
  preview: {
    port: 4173,
  },
  // lightmodal.js and lightmodal.css are loaded as plain scripts/links in index.html,
  // so no bundling config needed — Vite serves them as-is in dev mode.
})
