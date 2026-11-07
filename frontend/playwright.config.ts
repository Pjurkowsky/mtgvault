import { defineConfig, devices } from '@playwright/test'

// Separate ports and database so e2e runs never touch your dev data.
const API_PORT = 8100
const WEB_PORT = 5180
export const RATES = { EUR: 4.4, USD: 4.0 }
/** Fake camera for the scanner tests: Sol Ring on a table (built by e2e/camera.setup.ts). */
export const CAMERA_FEED = new URL('./e2e/.cache/camera.mjpeg', import.meta.url).pathname
/** Spec 019: Sol Ring with sleeve glare over its art, and out of focus so the model is unsure. */
export const GLARE_FEED = new URL('./e2e/.cache/glare.mjpeg', import.meta.url).pathname
export const UNSURE_FEED = new URL('./e2e/.cache/unsure.mjpeg', import.meta.url).pathname
/** Chromium flags for a fake camera playing `feed`. */
export const fakeCamera = (feed: string) => [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  `--use-file-for-fake-video-capture=${feed}`,
]
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/performance\.spec\.ts/, /scanner(-deck|-binder|-small|-glare|-guesses)?\.spec\.ts/, /\.setup\.ts/],
    },
    // Timing tests run alone after the rest, so parallel tests don't skew them.
    {
      name: 'performance',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /performance\.spec\.ts/,
      dependencies: ['chromium'],
    },
    { name: 'camera', testMatch: /camera\.setup\.ts/ },
    // Real recognition models with Chromium's fake camera (spec 003).
    {
      name: 'scanner',
      testMatch: /scanner(-deck|-binder|-small|-glare|-guesses)?\.spec\.ts/,
      // After the timing tests: recognition is CPU-heavy and would skew them.
      dependencies: ['camera', 'performance'],
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera'],
        launchOptions: {
          args: fakeCamera(CAMERA_FEED),
        },
      },
    },
  ],
  webServer: [
    {
      // Needs Postgres: docker compose -f docker-compose.dev.yml up -d db
      // Card fixture with fixed rates, so expected prices are exact (spec 001).
      command: [
        'uv run manage.py migrate --noinput',
        `uv run manage.py sync_cards --file cards/fixtures/scryfall-sample.jsonl --eur-pln ${RATES.EUR} --usd-pln ${RATES.USD}`,
        // Real recognition models (~50 MB, downloaded once per machine; spec 003).
        'uv run manage.py sync_scanner_bundle --if-missing',
        `uv run manage.py runserver 127.0.0.1:${API_PORT} --noreload`,
      ].join(' && '),
      cwd: '../backend',
      url: `http://127.0.0.1:${API_PORT}/api/health/`,
      env: {
        DATABASE_URL,
        DEBUG: 'True',
        AUTH_COOKIE_SECURE: 'False',
        // Own Redis database, and EDHREC from a file, so tests never touch dev data or the network.
        REDIS_URL: 'redis://localhost:6379/1',
        EDHREC_FIXTURE_DIR: 'cards/fixtures/edhrec',
        SCANNER_DIR: 'var/scanner-e2e',
      },
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
