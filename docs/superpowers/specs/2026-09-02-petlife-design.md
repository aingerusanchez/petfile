# Petlife — Especificación técnica (MVP v0)

> Aplicación para la gestión diaria y de salud de Loki, con evolución progresiva hacia uso compartido y multi-mascota.
> Fecha: 2026-09-02 · Versión: 0.1 (MVP v0)

---

## 1. Resumen ejecutivo

Petlife es una app móvil (con salida a web gracias a Expo Router) para registrar de forma ágil las rutinas diarias y la salud de Loki, sin perder datos de seguimiento durante sus primeros meses. Nace como una versión deliberadamente más ligera y de arranque rápido que **PetFile** (proyecto hermano, aparcado para una fase más ambiciosa en `../petfile`), reutilizando su identidad visual ("Nordic Ice") pero con un stack distinto elegido por agilidad y control propio.

**Usuario primario (MVP v0):** una sola persona (Aingeru), desde el móvil.

**Objetivos del MVP v0:**

- Registrar rutinas diarias (paseos, comidas, medicación, premios) con fricción mínima.
- Registrar eventos de salud (peso, incidencias, vacunas/desparasitaciones) con próxima fecha auto-calculada.
- Arrancar hoy, con datos seguros (backend gestionado, sin riesgo de pérdida por fallo local).
- Sentar una base de datos y arquitectura que permita compartir con la pareja (v1) y evolucionar a multi-dispositivo/responsive (v2) **sin cambios de stack ni reestructuración**.

**No-objetivos del MVP v0** (roadmap):

- Compartir el seguimiento con otra persona (v1).
- Notificaciones push reales (v1) — en v0 los avisos se muestran solo dentro de la app.
- Gráfica de peso con banda de percentiles por raza (post-v0) — v0 solo muestra la línea de peso propio.
- Multi-mascota / multi-especie (v2+).
- Publicación pública en App Store / Google Play.

---

## 2. Por qué no PetFile

PetFile (`../petfile`) ya cubre una versión más completa y ambiciosa del mismo problema (Angular + Nx + Firebase, multi-dispositivo, households). Se aparca intencionalmente para retomarlo en una fase más madura. Petlife prioriza **arrancar ya** con algo que el usuario controle de principio a fin, sin la ceremonia de ese stack, evolucionando con el uso real.

---

## 3. Arquitectura técnica

### 3.1 Stack

| Capa            | Tecnología                                                       |
| --------------- | ------------------------------------------------------------------ |
| Frontend        | Expo (React Native) + Expo Router — app universal (iOS/Android/Web) |
| Estilos         | NativeWind (Tailwind para React Native), tokens "Nordic Ice"       |
| Backend         | Supabase (Postgres, Auth, Storage)                                  |
| Lenguaje        | TypeScript strict                                                   |
| Gráficas        | `react-native-gifted-charts` (sobre `react-native-svg`)             |
| Test unitario   | Jest (`jest-expo`) — lógica pura                                    |
| Test UI/flujos  | Playwright contra el build web de Expo                              |
| Deploy          | EAS (build/update) para móvil · Vercel u hosting estático para web  |

**Justificación clave** (ver conversación de diseño): Supabase/Postgres evita el cambio de stack que el propio roadmap de PetFile ya anticipaba ("migración a Supabase si el SQL se vuelve necesario"); Expo da mejor rendimiento/gestos/push nativos que una PWA, y su modelo universal cubre el "responsive multi-dispositivo" de v2 sin reescritura; Playwright se elige sobre Jest para flujos de UI porque permite inspeccionar visualmente un fallo (trace viewer, vídeo, capturas), cosa que Jest no ofrece — y el usuario ya tiene tooling y experiencia con Playwright.

### 3.2 Estructura del proyecto

```
petlife/
├── app/                    # Expo Router — rutas por fichero
│   ├── (auth)/login.tsx
│   ├── (tabs)/home.tsx
│   ├── (tabs)/health.tsx
│   ├── (tabs)/profile.tsx
│   └── onboarding.tsx
├── lib/
│   ├── supabase.ts         # Cliente único de Supabase
│   ├── routines.ts         # Motor de recurrencias (lógica pura, testeada con Jest)
│   └── health.ts           # Cálculo de próxima fecha, lógica de salud (lógica pura)
├── components/
├── e2e/                     # Tests Playwright contra el build web
├── supabase/
│   └── migrations/          # Esquema SQL versionado
└── docs/superpowers/specs/  # Este documento
```

---

## 4. Modelo de datos (Postgres / Supabase)

```sql
profiles              -- extiende auth.users: id, display_name, avatar_url

pets                  -- id, name, species ('dog'), sex, breed_primary, breed_secondary,
                          is_mixed, birth_date, birth_date_approximate, photo_url,
                          spayed_neutered, activity_level, exercise_goal_minutes,
                          vet_primary jsonb, vet_emergency jsonb, created_at, updated_at

pet_owners            -- pet_id, user_id, role ('owner'|'member'), joined_at
                          ← clave para compartir en v1: añadir fila, no rediseñar

routine_templates     -- id, pet_id, type ('walk'|'meal'|'medication'|'treat'|'custom'),
                          title, time_of_day, recurrence_frequency ('daily'|'weekly'|'none'),
                          recurrence_days_of_week int[], metadata jsonb, active, created_at

routine_occurrences   -- id, pet_id, template_id (nullable = ítem puntual), date,
                          type, title, time_of_day, metadata jsonb,
                          status ('pending'|'completed'|'skipped'),
                          completed_at, completed_by, completion_data jsonb,
                          skip_reason, skip_category, notes, created_at
                          UNIQUE(date, template_id) — evita duplicados

health_events          -- id, pet_id, type, event_date, data jsonb (discriminado por type),
                          photos text[], created_by, created_at

invitations            -- id, pet_id, code, expires_at, used, used_by
                          ← tabla existe desde v0; su UI llega en v1
```

**Decisión clave**: no existe concepto de "household" — cada mascota tiene tutores directamente vía `pet_owners`. Esto simplifica v0 (una sola fila, tú) sin bloquear v1 (añadir una fila más) ni v2 (multi-mascota es, simplemente, más filas en `pets`).

**Seguridad**: Row Level Security en todas las tablas — cada policy exige pertenencia a `pet_owners` para el `pet_id` en cuestión. Equivalente directo a las security rules de Firestore que ya diseñó PetFile.

### 4.1 Tipos de `health_events` (MVP v0)

- `weight` — `{ kg: number }`
- `incident` — `{ category, severity: 1-5, description, suspectedCauses?, resolvedAt? }`
- `deworming_internal` / `deworming_external` / `vaccine_annual` / `vaccine_rabies` — `{ productName?, frequency: { value, unit }, nextDueAt }`

---

## 5. Alcance funcional MVP v0

### Historias de usuario

1. Puedo crear cuenta e iniciar sesión (Google o magic link) en menos de 2 minutos.
2. Doy de alta a Loki: nombre, raza, sexo, cumpleaños, esterilización, nivel de actividad.
3. Al abrir la app veo el checklist de rutinas del día con progreso.
4. Completo una rutina con swipe derecha o tap en el checkbox.
5. Salto una rutina con swipe izquierda, que abre un modal con nota obligatoria.
6. Al completar un paseo, ajusto la duración con chips rápidos (30/45/60 min).
7. Añado un ítem puntual (ej. "premio") desde un FAB sin crear una rutina recurrente.
8. Registro el peso de Loki y veo una gráfica simple de evolución (sin banda de percentiles).
9. Registro una incidencia de salud con categoría, severidad y notas.
10. Al registrar una vacuna/desparasitación, la próxima fecha se autocalcula según frecuencia configurable.
11. Veo dentro de la app (Home) los avisos de vencimientos próximos de salud — sin push.

### Navegación

Tabs: **Home** (checklist + alertas) · **Salud** (historial + registro) · **Perfil** (datos de Loki). Más `/login` y `/onboarding`.

---

## 6. UI / Diseño

Se reutiliza la identidad visual de PetFile ("Nordic Ice"): paleta y tipografía completas, migradas a tokens de NativeWind.

| Token              | Valor     | Uso                          |
| ------------------ | --------- | ----------------------------- |
| `bg-base`          | `#0B1120` | Fondo principal                |
| `bg-surface`       | `#131C2E` | Tarjetas, paneles               |
| `bg-elevated`      | `#1E293B` | Modales, inputs activos         |
| `bg-nav`           | `#0D1525` | Barra de navegación              |
| `border-default`   | `#1E293B` | Bordes sutiles                   |
| `border-strong`    | `#334155` | Bordes de foco/activos            |
| `accent-primary`   | `#A5F2F3` | Ice Blue — CTAs, estado activo    |
| `accent-secondary` | `#7DD3E8` | Acento secundario                  |
| `text-primary`     | `#F1F5F9` | Texto principal                     |
| `text-secondary`   | `#CBD5E1` | Texto secundario                     |
| `text-tertiary`    | `#94A3B8` | Hints, timestamps                     |
| `text-muted`       | `#64748B` | Disabled                               |
| `success`          | `#22C55E` | Estados completados                     |
| `warning`          | `#F59E0B` | Alertas, saltados                        |
| `error`            | `#EF4444` | Errores                                   |
| `info`             | `#3B82F6` | Informativo                                |

Tipografía: **Outfit** (Google Fonts), dark mode nativo como único modo en v0.

---

## 7. Manejo de errores y offline

Sin cola de sincronización offline en v0 (a diferencia de la persistencia de Firestore que tenía PetFile): si una escritura falla por falta de conexión durante un paseo, se muestra un error inline claro con botón de reintentar. Se revisará si añadir una cola local (v1) solo si el uso real demuestra que los cortes de conexión son un problema frecuente — no antes.

---

## 8. Testing

- **Jest (`jest-expo`)** para lógica de dominio pura: motor de recurrencias (`lib/routines.ts`), cálculo de próxima fecha (`lib/health.ts`). Sin necesidad de inspección visual — son funciones puras.
- **Playwright** contra el build web de Expo, para flujos con UI donde importa ver el estado visual al fallar (ej. alta de Loki, checklist del día): trace viewer, vídeo y capturas en cada paso.
- Sin E2E nativo (Maestro) en v0 — se evalúa en v1/v2 si hace falta verificar comportamiento específicamente nativo (gestos, push).

---

## 9. Roadmap

- **v0** (este documento): un usuario, móvil, sin compartir, sin push, gráfica simple.
- **v1**: compartir con la pareja (activar UI sobre `invitations` + `pet_owners`), notificaciones push reales (Edge Function programada + Expo push tokens), posible cola offline si hace falta.
- **v2**: universal/responsive (ya soportado por Expo Router), posible multi-mascota/especie — sin romper el modelo de datos actual.
- **Futuro más ambicioso**: retomar PetFile si Petlife se queda corto.

---

## 10. Criterios de aceptación del MVP v0

- [ ] Puedo crear cuenta e iniciar sesión en menos de 2 minutos.
- [ ] Puedo completar el alta de Loki con todos sus datos.
- [ ] El checklist del día se autogenera cada día al abrir la app.
- [ ] Completar un paseo permite indicar duración con chips rápidos.
- [ ] Saltar una rutina exige nota obligatoria.
- [ ] Añadir un ítem puntual desde el FAB no afecta a los templates.
- [ ] Registrar una desparasitación/vacuna actualiza automáticamente la próxima fecha según la frecuencia configurada.
- [ ] Registrar peso muestra la gráfica de evolución simple.
- [ ] Registrar una incidencia queda visible en el historial de Salud con todos sus datos.
- [ ] La app corre en iOS/Android vía Expo Go y en el build web, en dark mode.
- [ ] Un fallo de escritura por conexión muestra error + reintento, sin pérdida silenciosa de datos.

---

## 11. Decisiones resueltas

**Librería de gráficas: `react-native-gifted-charts`.** JS puro sobre `react-native-svg` (garantizado en Expo Go, sin riesgo de forzar un development build en v0), API simple y soporte de múltiples líneas/áreas para la futura superposición de la banda de percentiles. Su rendimiento se degrada a partir de ~1000 puntos, irrelevante para el volumen esperado (~50 pesajes/año). Se asume que su mantenimiento se ha ralentizado frente a `victory-native XL` (Skia, mantenido por Nearform): queda encapsulada tras un único componente de gráfica, de modo que migrar en v1/v2 —cuando ya exista un dev build por las notificaciones push— es un cambio contenido.

**Invitación de tutores: pospuesta a v1.** La tabla `invitations` existe en el esquema desde v0, pero su mecanismo concreto (código de 6 dígitos como en PetFile, o link directo) se decide al abordar v1.

**Skill `impeccable`: integración manual por el usuario** cuando llegue la fase de diseño de pantallas. No forma parte del plan de implementación.
