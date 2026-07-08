import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Solana web3.js / spl-token need Buffer + process in the browser.
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  build: {
    // Default (4kb) inlines every flag-icons SVG referenced from its CSS as a base64
    // data URI at build time — ~250 countries end up baked into the main CSS bundle
    // even though a given page only ever renders a handful of team flags. Disabling
    // inlining lets the browser fetch (and cache) only the flags actually rendered.
    assetsInlineLimit: 0,
  },
  server: {
    // Proxy TxLINE API through the dev server to avoid browser CORS.
    // Browser calls /txapi/... → https://txline.txodds.com/...
    proxy: {
      '/txapi': {
        target: 'https://txline.txodds.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/txapi/, ''),
      },
    },
  },
})
