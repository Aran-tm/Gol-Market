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
