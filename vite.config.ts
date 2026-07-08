import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// @solana/wallet-adapter-react-ui's styles.css @imports Google Fonts' "DM Sans" as its
// button font, render-blocking the page for ~1.3s — but src/index.css already overrides
// .wallet-adapter-button's font-family with !important, so that font is never actually
// rendered. Strip the dead @import at transform time (leaves node_modules untouched).
function stripDeadGoogleFont(): Plugin {
  return {
    name: 'strip-wallet-adapter-google-font',
    transform(code, id) {
      if (!id.includes('wallet-adapter-react-ui') || !id.endsWith('styles.css')) return;
      return code.replace(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com[^)'"]*['"]?\);?/, '');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Solana web3.js / spl-token need Buffer + process in the browser.
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
    stripDeadGoogleFont(),
  ],
  build: {
    // Default (4kb) inlines every flag-icons SVG referenced from its CSS as a base64
    // data URI at build time — ~250 countries end up baked into the main CSS bundle
    // even though a given page only ever renders a handful of team flags. Disabling
    // inlining lets the browser fetch (and cache) only the flags actually rendered.
    assetsInlineLimit: 0,
    sourcemap: true,
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
