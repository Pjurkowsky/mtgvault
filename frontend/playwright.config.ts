import { defineConfig, devices } from '@playwright/test'

// Separate ports and database so e2e runs never touch your dev data.
const API_PORT = 8100
const WEB_PORT = 5180
export const RATES = { EUR: 4.4, USD: 4.0 }
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://mtgvault:mtgvault@localhost:5432/mtgvault_e2e'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /performance\.spec\.ts/ },
    // Timing tests run alone after the rest, so parallel tests don't skew them.
    {
      name: 'performance',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /performance\.spec\.ts/,
      dependencies: ['chromium'],
    },
  ],
  webServer: [
    {
      // Needs Postgres: docker compose -f docker-compose.dev.yml up -d db
      // Card fixture with fixed rates, so expected prices are exact (spec 001).
      command: [
        'uv run manage.py migrate --noinput',
        `uv run manage.py sync_cards --file cards/fixtures/scryfall-sample.jsonl --eur-pln ${RATES.EUR} --usd-pln ${RATES.USD}`,
        `uv run manage.py runserver 127.0.0.1:${API_PORT} --noreload`,
      ].join(' && '),
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/api/health/`,
      env: { DATABASE_URL, DEBUG: 'True', AUTH_COOKIE_SECURE: 'False' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
})
