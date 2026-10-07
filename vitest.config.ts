import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so tests run without the PWA/Tailwind plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // A US zone with daylight saving, so day-window tests cover the clock changes.
    env: { TZ: 'America/Los_Angeles' },
  },
})
