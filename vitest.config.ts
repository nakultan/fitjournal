import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Test-only config, kept separate from vite.config.ts so the React and PWA
// build plugins don't load during unit tests. The data/logic layer is pure,
// so the tests run in a plain Node environment.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
