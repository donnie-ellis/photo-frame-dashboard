import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The wall tablet runs Android WebView 106 — keep JS output within Chromium 106.
// CSS targets chrome61 on purpose: the tablet's WebView rejects 4/8-digit hex colours (#0000,
// #ffffffbf) even though Chrome 106 should support them, and a newer target lets the minifier
// rewrite transparent/rgba() into that form. Verified on-device with CSS.supports().
export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'chrome106',
    cssTarget: 'chrome61',
  },
  // Dev only: send /api and /healthz to Prism (mock-service skill) or the real bridge.
  // API_TARGET=http://localhost:4010 FRAME_TOKEN=dev npm run dev
  server: {
    host: true,
    proxy: process.env.API_TARGET
      ? Object.fromEntries(
          ['/api', '/healthz'].map((path) => [
            path,
            {
              target: process.env.API_TARGET,
              changeOrigin: true,
              // changeOrigin rewrites Host but the browser's Origin stays :5173, so a real bridge
              // would 403 dev writes (v0.9.0). Drop it: no Origin is allowed. Prism doesn't enforce.
              configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
              headers: process.env.FRAME_TOKEN ? { Cookie: 'frame_token=' + process.env.FRAME_TOKEN } : {},
            },
          ]),
        )
      : {},
  },
});
