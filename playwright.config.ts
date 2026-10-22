import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // The whole suite shares one live Supabase account, and resetE2EPets()
  // deletes that account's pets mid-suite. Parallel workers would race it.
  workers: 1,
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
