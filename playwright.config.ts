import { defineConfig, devices } from '@playwright/test';

const staging = Boolean(process.env.FOCUSEDU_E2E_BASE_URL);
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    {
      name: 'local',
      testMatch: ['auth.local.spec.ts', 'project-footer.spec.ts', 'community.local.spec.ts'],
      use: { baseURL: 'http://localhost:4180' },
    },
    {
      name: 'staging',
      testMatch: 'release.staging.spec.ts',
      use: { baseURL: process.env.FOCUSEDU_E2E_BASE_URL },
    },
  ],
  webServer: staging
    ? undefined
    : {
        command: 'npm run dev -- --port 4180 --strictPort',
        url: 'http://localhost:4180',
        reuseExistingServer: false,
        env: {
          VITE_SUPABASE_URL: 'https://rc-test.invalid',
          VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_rc_fixture',
          VITE_DISCORD_AUTH_ENABLED: 'true',
        },
      },
});
