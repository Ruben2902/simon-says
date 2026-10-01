import { defineConfig, devices } from "@playwright/test";

const webPort = 3_110;
const serverPort = 3_111;
const useExternalServices = Boolean(process.env.E2E_BASE_URL);
const webUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const serverUrl =
  process.env.E2E_SERVER_URL ?? `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: useExternalServices
    ? undefined
    : [
        {
          command: "pnpm --filter @simon/server dev",
          env: {
            HOST: "127.0.0.1",
            NODE_ENV: "test",
            PORT: String(serverPort),
            ROOM_STORE_FILE: `../../.data/e2e-rooms-${process.pid}.json`,
            WEB_ORIGINS: webUrl,
          },
          reuseExistingServer: false,
          timeout: 120_000,
          url: `${serverUrl}/ready`,
        },
        {
          command: `pnpm --filter @simon/web exec next dev --hostname 127.0.0.1 --port ${webPort}`,
          env: {
            NEXT_PUBLIC_GAME_SERVER_URL: serverUrl,
          },
          reuseExistingServer: false,
          timeout: 120_000,
          url: webUrl,
        },
      ],
});
