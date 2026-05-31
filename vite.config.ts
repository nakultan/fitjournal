import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => {
  // GitHub Pages serves this project at /fitjournal/, and `vite preview`
  // serves the prod build (which has that base baked into asset URLs).
  // Local `npm run dev` stays at the root / for convenience.
  const base = command === 'build' || isPreview ? '/fitjournal/' : '/'

  return {
    base,

    resolve: {
      // Lets us write `import { Button } from '@/components'` instead of long
      // relative paths like '../../components'.
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    plugins: [
      react(),
      VitePWA({
        // 'prompt' = we ask the user before applying an update (see UpdatePrompt).
        registerType: 'prompt',
        // We own the service worker (src/sw.ts) so we can add a `push` handler
        // for the closed-app streak-save reminder. Workbox precaching still
        // happens — it's just called from our SW rather than auto-generated.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // Lets us test offline behaviour during `npm run dev`. `type: 'module'`
        // is required so the dev SW can use ES module imports.
        devOptions: { enabled: true, type: 'module' },
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'FitJournal',
          short_name: 'FitJournal',
          description:
            'Your personal fitness journal — workouts, weight, and progress, all on your device.',
          theme_color: '#0A84FF',
          background_color: '#000000',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: 'pwa-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        // In injectManifest mode the workbox config moves under `injectManifest`
        // (only the precache glob applies here — cleanup is done in our SW).
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        },
      }),
    ],
  }
})
