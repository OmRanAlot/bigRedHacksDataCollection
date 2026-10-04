import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5173', headless: true },
  projects: [
    { name: 'chromium', testMatch: 'collector.spec.ts', use: { browserName: 'chromium' } },
    { name: 'ipad-webkit', testMatch: 'ipad.spec.ts', use: { ...devices['iPad Pro 11'], browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
})
