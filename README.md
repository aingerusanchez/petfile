# Petfile

Track your pet's daily routines and health, backed by Supabase.

## Primeros pasos

```bash
git clone <repo-url>
cd petfile
pnpm install
cp .env.example .env
```

Rellena `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` en `.env` con los valores de tu proyecto de Supabase. Si no tienes un proyecto todavía, sigue [`docs/supabase-setup.md`](docs/supabase-setup.md), que cubre la creación del proyecto, las credenciales de Google OAuth y la cuenta de test de e2e.

Después:

```bash
pnpm web                 # target web, http://localhost:8081
pnpm android             # dev build nativo (Android) — la plataforma de destino
pnpm ios                 # dev build nativo (iOS)
```

El sign-in con Google necesita un dev build nativo (`pnpm android` / `pnpm ios`), no Expo Go — el flujo de OAuth usa un redirect de esquema personalizado que Expo Go no soporta. Ver el porqué en [`docs/supabase-setup.md`](docs/supabase-setup.md).

`pnpm android` lanza la app apuntando al servidor por la **IP de la LAN**, así que el móvil tiene que alcanzar el Mac por WiFi: si cae a datos móviles, entra en otra red o el firewall bloquea el puerto 8081, la app se queda en el splash **sin ningún error**. `pnpm android:usb` evita esa dependencia por completo — sirve en `127.0.0.1` a través de `adb reverse`, sobre el cable, y abre el dev build (nunca Expo Go). No recompila, así que es también la forma rápida de volver a entrar tras un cambio solo de JS.

## Secretos

- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_KEY` **no son secretos**: cualquier variable `EXPO_PUBLIC_*` se incrusta en el bundle del cliente y es extraíble por cualquiera con la app instalada. Los datos están protegidos por las políticas de RLS en `supabase/migrations/`, no por ocultar esta clave.
- La clave `service_role` de Supabase y el client secret de Google OAuth **nunca** entran en este repositorio. El client secret de Google se pega directamente en el dashboard de Supabase (Authentication → Providers → Google), donde Supabase hace el intercambio de tokens del lado del servidor.
- El hook `.githooks/pre-commit` bloquea el commit de `.env` (o cualquier `.env*` salvo `.env.example`) y de contenido con forma de secreto (claves `service_role`, JWTs, `sb_secret_...`, `GOCSPX-...`). `pnpm install` lo conecta automáticamente vía el script `prepare`.

## Desarrollo y testing

Esta app **no tiene bypass de autenticación en modo desarrollo**. Todos los entornos, incluido el desarrollo local, requieren un sign-in real con Google.

Los tests end-to-end de Playwright usan una cuenta de Supabase dedicada, identificada solo por email: `loki-e2e@example.com` (la contraseña nunca se documenta aquí — vive únicamente en `.env`, ver `E2E_EMAIL` / `E2E_PASSWORD` en `.env.example`).

```bash
pnpm test          # Jest — lógica de dominio pura (validación, mapeo de RPC, fechas, razas)
pnpm test:e2e       # Playwright — flujo completo (login, onboarding)
pnpm test:e2e:ui    # Playwright con UI mode, para depurar visualmente con el trace viewer
```

## Scripts

| Script             | Descripción                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `pnpm start`       | Arranca el servidor de Expo. Pulsa `a` para abrir en un dev build de Android ya instalado |
| `pnpm android`     | Compila, instala y lanza el dev build nativo de Android (`expo run:android`)              |
| `pnpm android:usb` | Vuelve a lanzar el dev build ya instalado **por cable**, sin recompilar                   |
| `pnpm ios`         | Compila, instala y lanza el dev build nativo de iOS (`expo run:ios`)                      |
| `pnpm web`         | Arranca el servidor de desarrollo apuntando a web                                         |
| `pnpm lint`        | `expo lint` — **actualmente roto** (ver nota abajo)                                       |
| `pnpm typecheck`   | `tsc --noEmit` — comprobación de tipos de todo el proyecto                                |
| `pnpm test`        | Ejecuta la suite de Jest                                                                  |
| `pnpm test:e2e`    | Ejecuta la suite end-to-end de Playwright                                                 |
| `pnpm test:e2e:ui` | Ejecuta Playwright en UI mode (trace viewer)                                              |

> **`pnpm lint` no funciona todavía.** El repo no tiene configuración de ESLint (`eslint.config.js` / `.eslintrc`), y su instalador automático (`expo lint`) ha causado problemas en más de una ocasión. Es un hueco conocido, fuera de alcance de esta tarea — no lo ejecutes esperando que funcione, y no intentes arreglarlo sin más contexto.

## Stack tecnológico

| Capa            | Tecnología                       | Versión                  |
| --------------- | -------------------------------- | ------------------------ |
| Framework       | Expo                             | ~57.0.19                 |
| Routing         | Expo Router                      | ~57.0.18                 |
| UI              | React Native                     | 0.86.3                   |
| UI              | React                            | 19.2.3                   |
| Lenguaje        | TypeScript                       | ~6.0.3                   |
| Estilos         | NativeWind                       | 5.0.0-preview.4          |
| Estilos         | Tailwind CSS                     | 4.3.3                    |
| Estilos         | `react-native-css`               | 3.0.7                    |
| Iconos          | `lucide-react-native`            | ^1.41.0                  |
| Iconos          | `react-native-svg`               | 15.15.4                  |
| Fechas          | `react-native-ui-datepicker`     | ^3.3.0                   |
| Imágenes        | `expo-image-picker`              | ~57.0.16                 |
| Imágenes        | `expo-image-manipulator`         | ~57.0.16                 |
| Insets          | `react-native-safe-area-context` | ~5.7.0                   |
| Backend         | `@supabase/supabase-js`          | ^2.112.4                 |
| Tests unitarios | Jest (`jest-expo`)               | ~29.7.0 (preset ~57.0.5) |
| Tests e2e       | Playwright                       | ^1.62.1                  |

## Arquitectura

```
app/                     → Expo Router: rutas por archivo (solo rutas, sin UI compartida)
  (auth)/                → login
  (tabs)/                → shell autenticado (home, health, profile)
components/ui/            → primitivos del sistema de diseño que componen las pantallas
  Screen.tsx              → contenedor de página; único sitio que consume los insets
  Chip.tsx                → chip selector + ChipGroup (fila de selección única)
  Group.tsx               → sección de formulario con contorno hairline
  Toast.tsx               → mensaje transitorio; ToastProvider lo monta sobre el navegador
  Celebration.tsx         → confeti de un disparo; CelebrationProvider lo monta sobre el navegador
  Checkbox.tsx            → flag booleano voluntario, sin marcar por defecto
  DateField.tsx           → fecha + picker propio (mes+año si es aproximada)
  BreedField.tsx          → combobox de raza: sugiere de una lista, acepta texto libre
  TextField.tsx           → input con etiqueta asociada, y la unidad dentro del campo
  FieldLabel.tsx          → la etiqueta de campo en mayúsculas
  Button.tsx              → botón: primario / outlined / secundario / link, con tono danger
  Avatar.tsx              → foto de la mascota, o su inicial cuando no hay foto
  AvatarEditor.tsx        → encuadre de esa foto sobre el círculo en el que se verá
  Text.tsx                → texto en la tipografía de la app; el único Text que importa la app
  LoadingScreen.tsx       → estado de carga a pantalla completa
  tokens.ts               → valores Nordic Ice para props de RN que className no alcanza
lib/                      → lógica de dominio y acceso a datos
  supabase.ts             → único punto de import de @supabase/supabase-js en el código de app
  auth.tsx                → contexto de sesión / OAuth de Google
  pets.ts                 → validación, creación, edición y borrado de la mascota
  photos.ts               → foto de la mascota: elegir, subir y firmar la URL de lectura
  failures.ts             → tope de espera de cada petición y su mensaje en la voz de la app
  dates.ts                → conversión entre el ISO del wire y el DD/MM/AAAA de la UI
  age.ts                  → la edad a partir de la fecha de nacimiento y su etapa de vida
  framing.ts              → las cuentas del recorte del avatar
  breeds.ts               → lista de razas y el reconocimiento de "mestizo"
supabase/migrations/      → esquema Postgres, RLS, funciones RPC
e2e/                       → specs de Playwright + helpers de sign-in
```

**Invariante clave:** las pantallas nunca importan `@supabase/supabase-js` directamente — dentro del código de la app, solo `lib/supabase.ts` lo hace. Cualquier acceso a datos pasa por `lib/`. (`e2e/auth.ts` también usa `createClient` directamente, pero es código de test: crea su propio cliente para sembrar la sesión y limpiar datos, fuera del runtime de la app.)

**Invariantes del sistema de diseño:** la UI compartida vive en `components/ui/`, nunca en `app/`, que es solo para rutas. Los insets de ventana se consumen **únicamente** en `Screen` — ninguna pantalla llama a `useSafeAreaInsets()` por su cuenta, y eso es lo que mantiene la acción principal fuera de la barra de navegación de Android en un solo sitio. Y cualquier color que necesite una prop de React Native sale de `components/ui/tokens.ts`, nunca de un hex reescrito a mano; `global.css` sigue siendo la fuente de verdad para todo lo que alcance un `className`.

**El registro del día y los datos de salud** viven en tres tablas que añade `0006_events_weights_treatments.sql`, y su forma sigue una sola regla: **lo que la app calcula lleva columnas; lo que solo enseña, no.** Paseos, comidas, medicación e incidencias comparten `pet_events` porque son el mismo tipo de hecho —algo pasó a una hora— y se leen como una lista; sus detalles van en `details`. Los pesos (`pet_weights`) y los tratamientos (`pet_treatments`) tienen tabla propia porque de ellos salen una línea y una fecha de próxima dosis, y un cálculo que lee de un `jsonb` es un cálculo frágil. La única clave promovida es la duración del paseo, porque el objetivo diario se mide contra su suma.

**La app encuadra la foto, no el sistema.** El picker se abre sin recorte (`allowsEditing: false`) para que llegue la imagen entera, `components/ui/AvatarEditor.tsx` la encuadra sobre el círculo en el que se verá, `lib/framing.ts` convierte la geometría del escenario en un rectángulo de recorte y `expo-image-manipulator` lo aplica. **`expo-image-manipulator` es módulo nativo:** después de traer este cambio hay que recompilar la dev build (`pnpm android`), no basta con recargar.

**La foto vive en Storage, no en la base.** `0005_pet_photos_bucket.sql` crea un bucket **privado** `pet-photos`, y `pets.photo_url` guarda la **ruta del objeto**, no una URL: la app firma una URL de una hora cuando va a mostrarla. Un bucket público sería el único sitio donde tener el enlace vencería a las políticas de RLS, y el nombre de la columna viene del esquema inicial — hoy miente a medias, y tanto la migración como `lib/photos.ts` lo dicen. Las políticas de storage resuelven la propiedad a través de `pet_owners`, la misma tabla que las de `pets`, así que compartir una mascota comparte su foto sin tocar nada.

El modelo de datos en Postgres no tiene concepto de "household": `pets` pertenece a uno o más usuarios a través de la tabla de unión `pet_owners`, protegida con RLS. Esto significa que compartir una mascota entre varios usuarios en el futuro es un `insert` en `pet_owners`, no un rediseño del esquema. La creación de una mascota es atómica vía una función RPC `security definer` (`create_pet_with_owner`) que escribe `pets` y `pet_owners` en la misma transacción.

## Compilación de producción

- **Nativo (iOS/Android):** se compila con [EAS Build](https://docs.expo.dev/build/introduction/) (`eas build`). **Todavía no configurado en este repo** — no existe `eas.json`; la primera build real requiere `eas init` para generarlo.
- **Web:** `expo export --platform web` genera un bundle estático desplegable en cualquier hosting estático (Vercel, Netlify, GitHub Pages, etc.).

## CI/CD

**No hay CI/CD configurado todavía.** No existe ningún workflow (por ejemplo en `.github/workflows/`) que ejecute lint, tests o builds automáticamente. Es un hueco conocido, no una omisión silenciosa.

## Documentación

- Setup de Supabase y Google OAuth: [`docs/supabase-setup.md`](docs/supabase-setup.md)
- Sistema de diseño: [`DESIGN.md`](DESIGN.md) — tokens, componentes y las reglas con nombre
- Contexto de producto: [`PRODUCT.md`](PRODUCT.md) — a quién sirve, qué está decidido y qué no
