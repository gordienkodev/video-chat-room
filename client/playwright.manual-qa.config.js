import { defineConfig, devices } from '@playwright/test'

const browserName = process.env.QA_BROWSER || 'firefox'
const channel = process.env.QA_CHANNEL || undefined
const executablePath = process.env.QA_EXECUTABLE_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName,
    channel,
    trace: 'off',
  },
  webServer: [
    {
      command: 'node ../server/index.js',
      env: {
        PORT: '3002',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: 'http://127.0.0.1:3002/health',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      url: 'http://127.0.0.1:5173',
    },
  ],
  projects: [
    {
      name: channel || browserName,
      use: {
        ...devices['Desktop Chrome'],
        browserName,
        channel,
        launchOptions: {
          executablePath,
          args: browserName === 'chromium'
            ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
            : [],
        },
        permissions: ['camera', 'microphone'],
      },
    },
  ],
})
