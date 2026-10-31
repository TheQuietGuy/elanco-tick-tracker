import { defineConfig, devices } from '@playwright/test';

// Starts the API (with a throwaway database) and the Vite dev server, then runs the browser tests.
export default defineConfig({
  testDir: 'e2e', timeout: 45_000, fullyParallel: false, workers: 1, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 860 } } }, { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ }],
  webServer: [
    { command: 'npm --prefix backend run start', url: 'http://127.0.0.1:4000/api/health', reuseExistingServer: true, env: { DB_PATH: 'data/e2e.db' }, timeout: 60_000 },
    { command: 'npm --prefix frontend run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
});
