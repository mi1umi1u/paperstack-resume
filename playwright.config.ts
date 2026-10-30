import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // 复用本机 Chrome，避免下载 100MB+ 的浏览器
    channel: 'chrome',
    viewport: { width: 1440, height: 900 }
  }
})
