import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

/**
 * Fast scanning (spec 003, AC-16): /scan/fast is cross-origin isolated so the
 * recognizer can use WASM threads. COEP `credentialless` on every response is
 * harmless elsewhere and lets the scanner's worker script start; COOP only on
 * /scan/fast is what isolates that page. Mirrors frontend/nginx.conf.
 */
function scanIsolation(): Plugin {
  return {
    name: 'scan-isolation',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
        if (req.url?.startsWith('/scan/fast')) res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), scanIsolation()],
  // onnxruntime-web ships its own WASM loader; pre-bundling it breaks the
  // runtime's file URLs and triggers a dev reload on first use.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  worker: { format: 'es' },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Forward API calls to the Django dev server ("backend" service in Docker)
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
})
