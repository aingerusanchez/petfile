# Petlife

Track your pet's daily routines and health, backed by Supabase.

## Primeros pasos

```bash
git clone <repo-url>
cd petlife
pnpm install
cp .env.example .env
```

Rellena `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` en `.env` con los valores de tu proyecto de Supabase. Si no tienes un proyecto todavía, sigue [`docs/supabase-setup.md`](docs/supabase-setup.md), que cubre la creación del proyecto, las credenciales de Google OAuth y la cuenta de test de e2e.

Después:

```bash
pnpm web                 # target web, http://localhost:8081
pnpm expo run:ios        # dev build nativo (iOS)
pnpm expo run:android    # dev build nativo (Android)
```

El sign-in con Google necesita un dev build nativo (`expo run:ios` / `expo run:android`), no Expo Go — el flujo de OAuth usa un redirect de esquema personalizado que Expo Go no soporta. Ver el porqué en [`docs/supabase-setup.md`](docs/supabase-setup.md).

## Secretos

- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` **no son secretos**: cualquier variable `EXPO_PUBLIC_*` se incrusta en el bundle del cliente y es extraíble por cualquiera con la app instalada. Los datos están protegidos por las políticas de RLS en `supabase/migrations/`, no por ocultar esta clave.
- La clave `service_role` de Supabase y el client secret de Google OAuth **nunca** entran en este repositorio. El client secret de Google se pega directamente en el dashboard de Supabase (Authentication → Providers → Google), donde Supabase hace el intercambio de tokens del lado del servidor.
- El hook `.githooks/pre-commit` bloquea el commit de `.env` (o cualquier `.env*` salvo `.env.example`) y de contenido con forma de secreto (claves `service_role`, JWTs, `sb_secret_...`, `GOCSPX-...`). `pnpm install` lo conecta automáticamente vía el script `prepare`.

## Desarrollo y testing

Esta app **no tiene bypass de autenticación en modo desarrollo**. Todos los entornos, incluido el desarrollo local, requieren un sign-in real con Google.

Los tests end-to-end de Playwright usan una cuenta de Supabase dedicada, identificada solo por email: `loki-e2e@example.com` (la contraseña nunca se documenta aquí — vive únicamente en `.env`, ver `E2E_EMAIL` / `E2E_PASSWORD` en `.env.example`).

```bash
pnpm test          # Jest — lógica de dominio pura (validación de mascotas, mapeo de RPC)
pnpm test:e2e       # Playwright — flujo completo (login, onboarding)
pnpm test:e2e:ui    # Playwright con UI mode, para depurar visualmente con el trace viewer
```

## Scripts

| Script            | Descripción                                              |
| ----------------- | --------------------------------------------------------- |
| `pnpm start`       | Arranca el servidor de desarrollo de Expo                 |
| `pnpm android`     | Arranca el servidor de desarrollo apuntando a Android      |
| `pnpm ios`         | Arranca el servidor de desarrollo apuntando a iOS          |
| `pnpm web`         | Arranca el servidor de desarrollo apuntando a web          |
| `pnpm lint`        | `expo lint` — **actualmente roto** (ver nota abajo)        |
| `pnpm test`        | Ejecuta la suite de Jest                                   |
| `pnpm test:e2e`    | Ejecuta la suite end-to-end de Playwright                  |
| `pnpm test:e2e:ui` | Ejecuta Playwright en UI mode (trace viewer)                |

> **`pnpm lint` no funciona todavía.** El repo no tiene configuración de ESLint (`eslint.config.js` / `.eslintrc`), y su instalador automático (`expo lint`) ha causado problemas en más de una ocasión. Es un hueco conocido, fuera de alcance de esta tarea — no lo ejecutes esperando que funcione, y no intentes arreglarlo sin más contexto.

## Stack tecnológico

| Capa                   | Tecnología           | Versión     |
| ---------------------- | --------------------- | ----------- |
| Framework               | Expo                   | ~57.0.19    |
| Routing                 | Expo Router            | ~57.0.18    |
| UI                       | React Native           | 0.86.3      |
| UI                       | React                  | 19.2.3      |
| Lenguaje                 | TypeScript             | ~6.0.3      |
| Estilos                  | NativeWind             | 5.0.0-preview.4 |
| Estilos                  | Tailwind CSS           | ^4.1.11     |
| Backend                  | `@supabase/supabase-js` | ^2.112.4  |
| Tests unitarios          | Jest (`jest-expo`)     | ~29.7.0 (preset ~57.0.5) |
| Tests e2e                | Playwright             | ^1.62.1     |

## Arquitectura

```
app/                     → Expo Router: rutas por archivo
  (auth)/                → login
  (tabs)/                → shell autenticado (home, health, profile)
lib/                      → lógica de dominio y acceso a datos
  supabase.ts             → único punto de import de @supabase/supabase-js
  auth.tsx                → contexto de sesión / OAuth de Google
  pets.ts                 → validación de mascotas + llamada a la RPC de creación
supabase/migrations/      → esquema Postgres, RLS, funciones RPC
e2e/                       → specs de Playwright + helpers de sign-in
```

**Invariante clave:** las pantallas nunca importan `@supabase/supabase-js` directamente — solo `lib/supabase.ts` lo hace. Cualquier acceso a datos pasa por `lib/`.

El modelo de datos en Postgres no tiene concepto de "household": `pets` pertenece a uno o más usuarios a través de la tabla de unión `pet_owners`, protegida con RLS. Esto significa que compartir una mascota entre varios usuarios en el futuro es un `insert` en `pet_owners`, no un rediseño del esquema. La creación de una mascota es atómica vía una función RPC `security definer` (`create_pet_with_owner`) que escribe `pets` y `pet_owners` en la misma transacción.

## Compilación de producción

- **Nativo (iOS/Android):** se compila con [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build`). **Todavía no configurado en este repo** — no existe `eas.json`; la primera build real requiere `eas init` para generarlo.
- **Web:** `expo export --platform web` genera un bundle estático desplegable en cualquier hosting estático (Vercel, Netlify, GitHub Pages, etc.).

## CI/CD

**No hay CI/CD configurado todavía.** No existe ningún workflow (por ejemplo en `.github/workflows/`) que ejecute lint, tests o builds automáticamente. Es un hueco conocido, no una omisión silenciosa.

## Documentación

- Spec de diseño: [`docs/superpowers/specs/2026-09-02-petlife-design.md`](docs/superpowers/specs/2026-09-02-petlife-design.md)
- Planes de implementación: [`docs/superpowers/plans/`](docs/superpowers/plans/)
- Setup de Supabase y Google OAuth: [`docs/supabase-setup.md`](docs/supabase-setup.md)
