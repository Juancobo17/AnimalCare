// Pruebas de extremo a extremo (npm run test:e2e).
//
// Necesitan el backend y el frontend corriendo:
//   backend:  REMINDERS_ENABLED=false npm run dev      (puerto 4000)
//   frontend: npm run dev                              (puerto 5173)
// E2E_BASE_URL y E2E_API_URL permiten apuntar a otros puertos.
// Al terminar, el teardown borra los usuarios "e2e.*" que crearon las pruebas.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  globalTeardown: "./e2e/teardown.js",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Sin PLAYWRIGHT_CHANNEL usa el Chromium de Playwright (CI);
      // con PLAYWRIGHT_CHANNEL=chrome usa el Chrome instalado en el equipo.
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    },
  ],
});
