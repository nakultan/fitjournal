import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // When we deploy to GitHub Pages this becomes '/<repo-name>/'.
  // For local dev and a custom domain it stays '/'.
  base: '/',

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
      // Lets us test offline behaviour during `npm run dev`.
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'FitJournal',
        short_name: 'FitJournal',
        description:
          'Your personal fitness journal — workouts, weight, and progress, all on your device.',
        theme_color: '#0A84FF',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: 'icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Pre-cache the whole app so it works fully offline after first load.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
