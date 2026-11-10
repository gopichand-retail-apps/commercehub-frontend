import { defineConfig } from "@playwright/test";

const isMock = process.env.NEXT_PUBLIC_IS_MOCK ?? "true";
const frontendPort = Number(process.env.COMMERCEHUB_E2E_FRONTEND_PORT ?? 5303);
const apiPort = Number(process.env.COMMERCEHUB_E2E_API_PORT ?? 5304);
const frontendUrl = `http://localhost:${frontendPort}`;
const frontendHealthUrl = `http://127.0.0.1:${frontendPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const unavailableApiOrigin = "http://127.0.0.1:1";

if (frontendPort === apiPort) {
  throw new Error("CommerceHub E2E frontend and API ports must be different.");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 15_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: "mvn spring-boot:run",
      cwd: "../commercehub-backend",
      url: `${apiOrigin}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        SERVER_ADDRESS: "127.0.0.1",
        SERVER_PORT: String(apiPort),
        DB_URL: "jdbc:h2:mem:commercehub_e2e;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        DB_USER: "sa",
        DB_PASSWORD: "",
        DB_DRIVER: "org.h2.Driver",
        COMMERCEHUB_FRONTEND_ORIGINS: `${frontendUrl},http://127.0.0.1:${frontendPort}`,
      },
    },
    {
      command: `npx next dev --hostname 127.0.0.1 --port ${frontendPort}`,
      url: frontendHealthUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_IS_MOCK: isMock,
        COMMERCEHUB_MOCK_API_URL: isMock === "true" ? apiOrigin : unavailableApiOrigin,
        COMMERCEHUB_REAL_API_URL: isMock === "false" ? apiOrigin : unavailableApiOrigin,
        COMMERCEHUB_NEXT_DIST_DIR: "node_modules/.cache/commercehub-e2e",
      },
    },
  ],
});
