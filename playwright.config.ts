import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

import { configuredAccounts } from "./e2e/accounts";

dotenv.config();

/**
 * One live Supabase account per worker, because `resetE2EPets()` deletes every
 * pet its account owns and `onboarding.spec.ts` needs its account to have no
 * pets at all. Both are server-side, so no amount of browser-context isolation
 * reaches them, which caps the worker count at the accounts `.env` carries.
 *
 * **Asking and not asking are treated differently, deliberately.** An explicit
 * `E2E_WORKERS` is honoured or refused, never quietly downgraded: two workers
 * sharing one account reintroduce exactly the race this removes, and it would
 * surface as tests failing on missing elements somewhere unrelated. The
 * default, which nobody asked for, instead takes what the accounts allow — so
 * a checkout or a CI runner holding one set of credentials runs in series and
 * passes, rather than failing at config load over a number it never chose.
 *
 * Measured 2026-10-29: 16.5 min on one worker against a mean 9.1 on two. A
 * saving that has to be remembered is a saving half the runs don't get, which
 * is why 2 is the default rather than an opt-in.
 */
const DEFAULT_WORKERS = 2;

const accounts = configuredAccounts();
const requested = process.env.E2E_WORKERS;
const workers =
  requested === undefined
    ? Math.max(1, Math.min(DEFAULT_WORKERS, accounts))
    : Number(requested);

if (requested !== undefined) {
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error(
      `E2E_WORKERS must be a positive integer, not "${requested}".`,
    );
  }
  if (workers > accounts) {
    throw new Error(
      `E2E_WORKERS=${workers} but .env configures ${accounts} e2e account(s). ` +
        "Add E2E_EMAIL_2 / E2E_PASSWORD_2 (see docs/supabase-setup.md) or lower E2E_WORKERS.",
    );
  }
} else if (workers < DEFAULT_WORKERS) {
  // Says it once, and only where the default could not be met. Counting the
  // accounts never reads a value out of `.env`, only whether a name is filled.
  console.warn(
    `[e2e] ${accounts} account(s) configured, so running on ${workers} worker(s) ` +
      `instead of ${DEFAULT_WORKERS}. See docs/supabase-setup.md to add another.`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers,
  // Splitting files across workers alone would buy almost nothing: home.spec.ts
  // is 128 of the 237 tests and 11 of the 17 minutes, and a file never spans
  // workers, so it would be the floor however many workers there are. Every
  // spec seeds in `beforeEach` and the only `beforeAll` any of them has is the
  // read-only `eventsTableExists()` probe, so splitting inside a file is safe
  // once each worker owns its own account.
  fullyParallel: workers > 1,
  use: {
    baseURL: "http://localhost:8081",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm web",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // `pnpm web` es `expo start --web`: un proceso de Node que contiene Metro,
    // y Metro se queda con todo lo que empaqueta. Con el montón de V8 por
    // defecto (~4 GB) la suite muere a mitad — tres veces seguidas en el mismo
    // punto, e2e/notes.spec.ts, con «JavaScript heap out of memory». Lo que
    // cae es el servidor, no la prueba, así que los specs que vienen detrás
    // fallan todos con ERR_CONNECTION_REFUSED y ninguno dice nada del código.
    //
    // **Esto no arregla el consumo, lo tapa.** No está establecido si Metro
    // tiene una fuga o si 600 pruebas sobre un servidor que no se reinicia
    // simplemente acumulan más de lo que cabe; subir el techo compra sitio
    // para seguir trabajando y deja la pregunta abierta. Si vuelve a morir
    // aquí, el techo no es la respuesta: medir antes de volver a subirlo.
    env: { NODE_OPTIONS: "--max-old-space-size=8192" },
  },
});
