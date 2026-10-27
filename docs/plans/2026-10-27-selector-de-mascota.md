# Selector de mascota — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la app deje de resolver «el perro» como «el primero que creaste» y siga una mascota activa que el tutor elige, con un conmutador que no existe mientras haya una sola.

**Architecture:** la mascota activa es un id en `AsyncStorage` detrás de un proveedor de contexto, calcado de `lib/settings.tsx`. `getMyPet` deja de pedir una fila y pide la lista, y una función pura decide cuál de ellas está activa; las pantallas siguen con su propio efecto de carga y solo añaden el id a sus dependencias. La interfaz es una fila arriba de Perfil que abre una hoja, y nada más.

**Tech Stack:** Expo Router, React Native 0.86, Supabase (vía `lib/supabase.ts`), AsyncStorage, NativeWind 5, Jest, Playwright.

**Spec:** `docs/specs/2026-10-26-compartir-la-ficha-design.md`, §12 y sus apartados 12.1 y 12.2. El dibujo de las cuatro variantes está en el artboard `Selector` del tablero (https://claude.ai/artifact/GxfzoMzhtoH6bkaAWUNvyL).

**Versión:** 0.27.0. Un único commit de release al final (tarea 8) lleva el bump de `package.json` y la entrada entera de `CHANGELOG.md`; los commits de tarea no tocan ninguno de los dos.

## Global Constraints

Valen para todas las tareas, y salen de `AGENTS.md`:

- **pnpm únicamente.** Nunca ejecutar `pnpm install`: las dependencias de este plan ya están todas en `package.json`.
- **TypeScript estricto, sin `any`** en código commiteado. `pnpm typecheck` es parte del gate: ESLint no mira tipos.
- **Ningún color crudo.** Todo sale de los tokens Nordic Ice: `className` para lo que alcanza, `components/ui/tokens.ts` para las props de React Native que no.
- **`Text` se importa de `components/ui`**, nunca de `react-native`.
- **Ninguna pantalla importa `@supabase/supabase-js`**; el único sitio es `lib/supabase.ts`.
- **Un `Pressable` nunca recibe un `style` de callback.** Objeto plano para los números, `active:opacity-70` en la lista de clases.
- **Las alturas de pulsación salen de `TOUCH_TARGET`** (`components/ui/tokens.ts`), nunca de `min-h-12`, que en nativo mide 42 dp.
- **Los insets de ventana solo se consumen en `Screen` y `Sheet`.**
- **Conventional Commits**, imperativo, minúscula, sin punto final.
- **Definición de hecho por tarea:** `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde. `pnpm test:e2e` entra en la tarea 8, y **solo una suite a la vez en esta máquina** porque comparten cuenta de Supabase.

## Review Focus

Cinco cosas que la spec implica, que ninguna tarea probaría por su cuenta, y que muerden a quien usa esto. Cada una lleva su test en la tarea que posee el código:

1. **La mascota activa guardada ya no existe** —borrada desde el otro teléfono, o por el propio tutor—: hay que caer a la más antigua, no devolver `null` ni dejar la pantalla vacía. → tarea 1.
2. **Hay un paseo abierto al actualizar la app**, con el blob viejo de una sola ranura en el almacenamiento: tiene que seguir siendo el paseo en curso y no desaparecer. → tarea 2.
3. **Cambiar de mascota con un paseo en marcha**: el botón de la segunda no puede aparecer en marcha porque la primera lo esté. → tarea 6.
4. **Cambiar de mascota mientras una lectura está en vuelo**: la respuesta de la anterior no puede pintar sobre la nueva. **Éste no lleva test y conviene decirlo**: en Jest pediría simular el transporte, y en Playwright sería una carrera contra el reloj, que es justo lo que este proyecto tiene prohibido. Se verifica leyendo: cada efecto que gane la dependencia `activePetId` tiene que conservar su `cancelled`, y es lo primero que mira la revisión de las tareas 5, 6 y 7.
5. **Borrar la mascota activa desde Perfil**: el id guardado queda huérfano, y la pantalla tiene que pasar a la otra o al alta, nunca a un Perfil en blanco. → tarea 5.

---

## Estructura de ficheros

| Fichero                                                                        | Responsabilidad                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `lib/pets.ts` _(modificar)_                                                    | `listMyPets` pide todas las fichas; `pickActivePet` decide cuál está activa; `getMyPet` pasa a ser su composición. |
| `lib/walk.ts` _(modificar)_                                                    | El paseo en curso deja de ser una ranura y pasa a ser un mapa por mascota, con migración del blob viejo.           |
| `lib/pet.tsx` _(crear)_                                                        | Proveedor de la mascota activa: id en `AsyncStorage`, contexto, `useActivePet`. Calca `lib/settings.tsx`.          |
| `components/ui/PetSwitcher.tsx` _(crear)_                                      | La fila de 40 dp y la hoja que abre. No dibuja nada con menos de dos mascotas.                                     |
| `app/_layout.tsx` _(modificar)_                                                | Monta el proveedor.                                                                                                |
| `app/(tabs)/profile.tsx` _(modificar)_                                         | Coloca el conmutador arriba y «Añadir otra mascota» al pie.                                                        |
| `app/onboarding.tsx` _(modificar)_                                             | Su guarda distingue llegar por accidente de pedir una segunda.                                                     |
| `app/(tabs)/index.tsx` _(modificar)_                                           | Sigue la mascota activa, y su paseo en curso va por mascota.                                                       |
| `app/(tabs)/health.tsx`, `app/weights.tsx`, `app/treatments.tsx` _(modificar)_ | Siguen la mascota activa.                                                                                          |
| `e2e/pets.spec.ts` _(crear)_                                                   | El flujo: dos fichas, cambiar, y que el Diario cambie con ella.                                                    |

`app/index.tsx` **no** entra: su pregunta es «¿tiene alguna ficha?», que no depende de cuál esté activa.

---

### Task 1: La lista de fichas y cuál está activa

**Files:**

- Modify: `lib/pets.ts` (`getMyPet`, al final del fichero)
- Test: `lib/__tests__/pets.test.ts`

**Interfaces:**

- Produces:
  - `pickActivePet(pets: PetRow[], storedId: string | null): PetRow | null` — pura.
  - `listMyPets(): Promise<{ pets: PetRow[]; error: string | null }>`
  - `getMyPet(storedId?: string | null): Promise<{ pet: PetRow | null; error: string | null }>` — la firma vieja sigue valiendo, porque el parámetro es opcional.

- [ ] **Step 1: Escribir los tests que fallan en `lib/__tests__/pets.test.ts`**

```ts
describe("pickActivePet", () => {
  const loki = { id: "p1", name: "Loki" } as PetRow;
  const nala = { id: "p2", name: "Nala" } as PetRow;

  it("sin fichas no hay activa", () => {
    expect(pickActivePet([], "p1")).toBeNull();
  });

  it("sin id guardado toma la primera, que es la más antigua", () => {
    expect(pickActivePet([loki, nala], null)).toBe(loki);
  });

  it("con id guardado toma esa", () => {
    expect(pickActivePet([loki, nala], "p2")).toBe(nala);
  });

  // Review Focus 1: la ficha guardada se borró desde el otro teléfono.
  it("con un id que ya no existe cae a la más antigua, no a null", () => {
    expect(pickActivePet([loki, nala], "p9")).toBe(loki);
  });
});
```

- [ ] **Step 2: Correr y ver el rojo**

Run: `pnpm test -- pets.test`
Expected: FAIL, `pickActivePet is not a function`.

- [ ] **Step 3: Implementar `pickActivePet(pets, storedId)` en `lib/pets.ts`**

Pura y sin consultas. El comentario que ya existe sobre el orden explícito se queda, porque ahora es lo que hace que «la más antigua» signifique algo estable.

- [ ] **Step 4: Implementar `listMyPets()` y rehacer `getMyPet(storedId)` sobre ella**

`listMyPets` es la consulta de `getMyPet` sin `.limit(1)` ni `.maybeSingle()`, con el mismo `withTimeout` y el mismo `describeFailure`. `getMyPet(storedId = null)` la llama y devuelve `pickActivePet(pets, storedId)`. La clave de `lib/failures.ts` sigue siendo `getMyPet`; **añadir ahí también `listMyPets: "leer las fichas"`**, porque sin ella el fallo no tiene frase.

- [ ] **Step 5: Verde**

Run: `pnpm test -- pets.test && pnpm typecheck`
Expected: PASS las dos.

- [ ] **Step 6: Commit**

```bash
git add lib/pets.ts lib/failures.ts lib/__tests__/pets.test.ts
git commit -m "feat(pets): la ficha activa se elige, y una que ya no existe cae a la primera"
```

---

### Task 2: El paseo en curso, por mascota

Hoy `petfile.walk.v1` guarda `{"id": "<paseo>"}`: **una sola ranura**. Con dos animales guardaría el paseo del otro, que es el defecto latente que el selector activa (spec §12.2).

**Files:**

- Modify: `lib/walk.ts`
- Test: `lib/__tests__/walk.test.ts`

**Interfaces:**

- Produces:
  - `parseRunningWalk(raw: string | null, petId: string): string | null`
  - `withRunningWalk(raw: string | null, petId: string, walkId: string): string`
  - `withoutRunningWalk(raw: string | null, petId: string): string`
  - `WALK_STORAGE_KEY` no cambia de valor: la migración va en el contenido, no en la clave.
  - `serialiseRunningWalk` desaparece; `withRunningWalk` ocupa su sitio.

- [ ] **Step 1: Escribir los tests que fallan**

Los cuatro tests que ya hay cambian de firma. Los nuevos:

```ts
it("guarda un paseo por mascota sin pisar el de la otra", () => {
  const a = withRunningWalk(null, "p1", "w1");
  const b = withRunningWalk(a, "p2", "w2");
  expect(parseRunningWalk(b, "p1")).toBe("w1");
  expect(parseRunningWalk(b, "p2")).toBe("w2");
});

it("una mascota sin paseo abierto no tiene paseo", () => {
  expect(parseRunningWalk(withRunningWalk(null, "p1", "w1"), "p2")).toBeNull();
});

it("quitar el de una deja el de la otra", () => {
  const two = withRunningWalk(withRunningWalk(null, "p1", "w1"), "p2", "w2");
  const left = withoutRunningWalk(two, "p1");
  expect(parseRunningWalk(left, "p1")).toBeNull();
  expect(parseRunningWalk(left, "p2")).toBe("w2");
});

// Review Focus 2: se actualiza la app con un paseo abierto.
it("adopta el blob viejo de una sola ranura", () => {
  expect(parseRunningWalk(JSON.stringify({ id: "w1" }), "p1")).toBe("w1");
});

it("la primera escritura reescribe el blob viejo en la forma nueva", () => {
  const next = withRunningWalk(JSON.stringify({ id: "w1" }), "p2", "w2");
  expect(parseRunningWalk(next, "p2")).toBe("w2");
  expect(parseRunningWalk(next, "p1")).toBeNull();
});

it("lo que no se entiende es nada", () => {
  expect(parseRunningWalk("{not json", "p1")).toBeNull();
  expect(
    parseRunningWalk(JSON.stringify({ walks: { p1: 7 } }), "p1"),
  ).toBeNull();
});
```

- [ ] **Step 2: Correr y ver el rojo**

Run: `pnpm test -- walk.test`
Expected: FAIL por firma y por funciones que no existen.

- [ ] **Step 3: Implementar las tres en `lib/walk.ts`**

Forma nueva del blob: `{"walks": {"<petId>": "<walkId>"}}`. Un blob viejo `{"id": …}` se lee como el paseo de **la mascota que se pregunte**, porque precede a que pudiera haber dos; la primera escritura lo deja en la forma nueva y esa ambigüedad se cierra. El docblock del fichero dice hoy que el paseo en curso vive en el dispositivo y por qué — **ampliarlo con por qué ahora va por mascota**, en el tono del resto del fichero.

- [ ] **Step 4: Verde**

Run: `pnpm test -- walk.test`
Expected: PASS. `pnpm typecheck` fallará todavía en `app/(tabs)/index.tsx`, que es la tarea 6: no arreglarlo aquí.

- [ ] **Step 5: Commit**

```bash
git add lib/walk.ts lib/__tests__/walk.test.ts
git commit -m "feat(walk): el paseo en curso se guarda por mascota, no en una ranura"
```

---

### Task 3: El proveedor de la mascota activa

Calca `lib/settings.tsx`: función de parseo pura y probada, contexto, escritura en `AsyncStorage` que no bloquea.

**Files:**

- Create: `lib/pet.tsx`
- Create: `lib/__tests__/pet.test.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**

- Produces:
  - `ACTIVE_PET_STORAGE_KEY = "petfile.pet.v1"`
  - `parseActivePetId(raw: string | null): string | null`
  - `ActivePetProvider({ children }: { children: ReactNode })`
  - `useActivePet(): { activePetId: string | null; setActivePetId: (id: string) => void }`

- [ ] **Step 1: Escribir los tests que fallan en `lib/__tests__/pet.test.ts`**

```ts
describe("parseActivePetId", () => {
  it("sin nada guardado no hay mascota activa", () => {
    expect(parseActivePetId(null)).toBeNull();
  });

  it("lee el id guardado", () => {
    expect(parseActivePetId(JSON.stringify({ id: "p1" }))).toBe("p1");
  });

  it("lo que no se entiende es nada", () => {
    expect(parseActivePetId("{not json")).toBeNull();
    expect(parseActivePetId(JSON.stringify({ id: 7 }))).toBeNull();
    expect(parseActivePetId(JSON.stringify({ id: "" }))).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver el rojo**

Run: `pnpm test -- pet.test`
Expected: FAIL, el módulo no existe.

- [ ] **Step 3: Escribir `lib/pet.tsx`**

Mismo esqueleto que `lib/settings.tsx`: lectura inicial en un efecto, estado en memoria como fuente durante la sesión, escritura con `void AsyncStorage.setItem(...).catch(...)`. **`activePetId` es el id guardado tal cual, no la ficha resuelta**: quién está activa lo decide `pickActivePet` (tarea 1) en cada pantalla, con la lista que esa pantalla ya tiene.

- [ ] **Step 4: Montar `ActivePetProvider` en `app/_layout.tsx`**

Dentro de `AuthProvider` y fuera de `ToastProvider`, al lado de `SettingsProvider`: es un dato de sesión, no de presentación.

- [ ] **Step 5: Verde**

Run: `pnpm test -- pet.test && pnpm lint && pnpm typecheck`
Expected: PASS las tres.

- [ ] **Step 6: Commit**

```bash
git add lib/pet.tsx lib/__tests__/pet.test.ts app/_layout.tsx
git commit -m "feat(pet): la mascota activa vive en el dispositivo, como los formatos"
```

---

### Task 4: El conmutador

La fila y la hoja del artboard `Selector`. **No dibuja nada con menos de dos mascotas** (spec §12.1).

**Files:**

- Create: `components/ui/PetSwitcher.tsx`
- Modify: `components/ui/index.ts` (exportarlo)
- Test: `components/__tests__/` no aplica — esto se prueba en la tarea 8 con Playwright, como el resto de la interfaz de este proyecto.

**Interfaces:**

- Consumes: `Sheet`, `Avatar`, `Text`, `Button` de `components/ui`; `TOUCH_TARGET` y `colors` de `components/ui/tokens.ts`.
- Produces:
  - `export type PetChoice = { id: string; name: string; photoUri: string | null }`
  - `PetSwitcher({ pets, activeId, onSelect }: { pets: PetChoice[]; activeId: string; onSelect: (id: string) => void })`

- [ ] **Step 1: Escribir `components/ui/PetSwitcher.tsx`**

Qué dibuja, y el resto es composición de primitivas que ya existen:

- `pets.length < 2` → `null`. Es la regla de invisibilidad y va lo primero, antes de cualquier estado.
- La fila: `Pressable` con `Avatar` de `size={40}`, el nombre a `font-semibold text-text-primary`, y un `ChevronDown` de `lucide-react-native` a `colors.textTertiary`. Altura mínima `TOUCH_TARGET` por `style` objeto; `active:opacity-70` en la clase.
- `accessibilityRole="button"` y `accessibilityLabel={`Cambiar de mascota. Ahora: ${activeName}`}` — el nombre solo no dice que sea un control.
- Al pulsar, un `Sheet` con una fila por mascota: `Avatar` de 40, el nombre, y un `Check` de `lucide-react-native` en `colors.accent` sobre la activa. Cada fila es un `Pressable` de `TOUCH_TARGET`, con `accessibilityState={{ selected: id === activeId }}`.
- La hoja **no** lleva «Añadir otra mascota»: eso vive al pie de Perfil (tarea 5, y spec §12.2).
- `testID`: `pet-switcher` en la fila, `pet-switcher-sheet` en la hoja, `pet-choice-<id>` en cada opción.

- [ ] **Step 2: Exportarlo desde `components/ui/index.ts`** junto al resto de primitivas.

- [ ] **Step 3: Verde**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS las tres. `pnpm test` incluye `components/__tests__/function-styles.test.ts` y `class-strings.test.ts`, que fallan si este componente le da un `style` de callback a un `Pressable` o interpola una clase sin espacio delante.

- [ ] **Step 4: Commit**

```bash
git add components/ui/PetSwitcher.tsx components/ui/index.ts
git commit -m "feat(ui): un conmutador de mascota que no existe cuando solo hay una"
```

---

### Task 5: Perfil monta el conmutador y abre el camino a la segunda

**Files:**

- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/onboarding.tsx` (la guarda de las líneas ~274-300)

**Interfaces:**

- Consumes: `PetSwitcher`, `PetChoice` (tarea 4); `useActivePet` (tarea 3); `listMyPets`, `pickActivePet` (tarea 1); `signedPhotoUrl` de `lib/photos.ts` para cada `PetChoice`.

- [ ] **Step 1: Cambiar la carga de Perfil para que pida la lista**

El efecto de la línea ~202 pasa de `getMyPet()` a `listMyPets()`, guarda la lista y deriva la activa con `pickActivePet(pets, activePetId)`. `activePetId` entra en las dependencias del efecto. El `cancelled` que ya tiene se queda: es lo que cierra la carrera del Review Focus 4.

- [ ] **Step 2: Colocar `<PetSwitcher>` como primer hijo del contenido de la pantalla**, encima del bloque de la ficha.

`pets` es la lista mapeada a `PetChoice`, con `photoUri` ya firmada por
`signedPhotoUrl` para cada una. `activeId` es **`pet.id` de la ficha resuelta
por `pickActivePet`, no `activePetId`**: el id guardado puede ser `null` en el
primer arranque o apuntar a una ficha borrada, y el conmutador tiene que
marcar la que la pantalla está enseñando de verdad. `onSelect={setActivePetId}`.

- [ ] **Step 3: Añadir el botón al pie**

Un `Button` de variante `link` con `label="Añadir otra mascota"`, junto a `Ajustes` y `Cerrar sesión`, **visible siempre** incluido con una sola mascota — sin él no hay forma de llegar a la segunda. Navega a `/onboarding?another=1`.

- [ ] **Step 4: Dejar pasar a quien lo pide en `app/onboarding.tsx`**

La guarda que hoy rechaza a quien ya tiene ficha se salta cuando `useLocalSearchParams()` trae `another === "1"`. El comentario que explica por qué existe la guarda —evitar un duplicado por navegación hacia atrás— **se amplía, no se borra**: sigue siendo cierto para quien llega sin pedirlo.

- [ ] **Step 5: Decidir qué pasa al borrar la mascota activa** _(Review Focus 5)_

Tras un borrado con éxito, el id guardado apunta a nada. `pickActivePet` ya cae a la más antigua (tarea 1), así que basta con **volver a cargar la lista** en lugar de navegar a ciegas: si queda otra ficha, Perfil se queda en ella; si no queda ninguna, el camino al alta que ya existe hace su trabajo. No hace falta limpiar el id guardado.

- [ ] **Step 6: Verde**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS las tres.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/profile.tsx" app/onboarding.tsx
git commit -m "feat(profile): el conmutador arriba y el camino a una segunda mascota al pie"
```

---

### Task 6: El Diario sigue la mascota activa, y su paseo va con ella

Dos cambios en un fichero porque son el mismo: qué animal mira la pantalla.

**Files:**

- Modify: `app/(tabs)/index.tsx` (la carga de la línea ~943; los cinco usos de `WALK_STORAGE_KEY` en ~862, ~1491, ~1528, ~1660, ~1670)

**Interfaces:**

- Consumes: `useActivePet` (tarea 3); `listMyPets`, `pickActivePet` (tarea 1); `parseRunningWalk`, `withRunningWalk`, `withoutRunningWalk` (tarea 2).

- [ ] **Step 1: Cambiar la carga a la lista, con `activePetId` en las dependencias**

Igual que el paso 1 de la tarea 5. **El día no se repone**: `day` no entra en este efecto ni se reinicia al cambiar de mascota, porque la mascota y el día son dos ejes independientes (spec §12.2).

- [ ] **Step 2: Pasar el id de la mascota a las cinco llamadas del almacenamiento**

La lectura usa `parseRunningWalk(raw, pet.id)`. Las escrituras dejan de hacer `setItem`/`removeItem` a secas y pasan por leer-modificar-escribir con `withRunningWalk` / `withoutRunningWalk`, porque el blob ya no es de una sola mascota.

- [ ] **Step 3: Escribir la prueba de que el paseo no se contagia** _(Review Focus 3)_

Es lógica de `lib/`, así que va en `lib/__tests__/walk.test.ts` con el resto:

```ts
it("el paseo de una mascota no aparece como el de la otra", () => {
  const raw = withRunningWalk(null, "p1", "w1");
  expect(parseRunningWalk(raw, "p1")).toBe("w1");
  expect(parseRunningWalk(raw, "p2")).toBeNull();
});
```

- [ ] **Step 4: Verde**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS las tres. **El typecheck de la tarea 2 se cierra aquí**, que es donde se dijo que se cerraría.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" lib/__tests__/walk.test.ts
git commit -m "feat(home): el diario sigue a la mascota activa y su paseo no se contagia"
```

---

### Task 7: Salud, Peso y Tratamientos siguen la mascota activa

Tres ficheros, el mismo cambio en cada uno. **Un solo despacho y una sola revisión**: no tienen juicio propio.

**Files:**

- Modify: `app/(tabs)/health.tsx` (~163), `app/weights.tsx` (~46), `app/treatments.tsx` (~65)

**Interfaces:**

- Consumes: `useActivePet` (tarea 3); `getMyPet(storedId)` (tarea 1).

- [ ] **Step 1: En cada uno, pasar `activePetId` a `getMyPet` y añadirlo a las dependencias del efecto**

Estas tres no necesitan la lista: no dibujan el conmutador, solo leen de la mascota activa, así que `getMyPet(activePetId)` basta. El `cancelled` que ya tienen se queda _(Review Focus 4)_.

- [ ] **Step 2: Verde**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS las tres.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/health.tsx" app/weights.tsx app/treatments.tsx
git commit -m "feat(pets): salud, peso y tratamientos leen de la mascota activa"
```

---

### Task 8: El flujo de punta a punta, y la versión

**Files:**

- Create: `e2e/pets.spec.ts`
- Modify: `package.json` (versión), `CHANGELOG.md`

- [ ] **Step 1: Escribir `e2e/pets.spec.ts`**

Cinco casos, con `resetE2EPets()` y el alta que `e2e/onboarding.spec.ts` ya sabe hacer:

1. **Con una mascota no hay conmutador.** `pet-switcher` no está en Perfil, y `Añadir otra mascota` sí.
2. **Con dos aparece**, y la hoja lista las dos con la activa marcada.
3. **Cambiar de mascota cambia el Diario**: elegir la segunda y comprobar que `home-title` habla de ella.
4. **El día se mantiene al cambiar** _(spec §12.2)_: pulsar ‹ para retroceder un día, cambiar de mascota, y comprobar que `home-date` no ha vuelto a hoy.
5. **Borrar la mascota activa deja la otra** _(Review Focus 5)_: con dos fichas y la segunda activa, borrarla desde Perfil y comprobar que la pantalla queda en la primera y no en blanco.

El caso 4 retrocede un día con ‹ en vez de escribir una hora fija, por la regla de `e2e/home.spec.ts`: **un test que teclea una hora de la mañana sobre hoy falla media jornada.**

- [ ] **Step 2: Correr la suite entera**

Run: `pnpm test:e2e`
Expected: PASS, incluidas las que ya había. Si muere en bloque con `ERR_CONNECTION_REFUSED`, es el servidor de desarrollo, no el código: `pkill -f "expo start"` y repetir — y mirar antes si murió por memoria, que es la causa medida (`AGENTS.md`, Tests).

- [ ] **Step 3: Verificar en el dispositivo**

`pnpm android`, y comprobar las dos cosas que el navegador esconde: que la fila del conmutador mide 48 dp de verdad, y que con una sola mascota la pantalla de Perfil está **exactamente** como antes. Captura con `adb exec-out screencap -p`.

- [ ] **Step 4: El commit de release**

`package.json` a `0.27.0` y la entrada entera de `CHANGELOG.md` en un único commit, con el tono del resto del fichero: qué cambió y por qué estaba mal, no «se arregló un fallo». Decir que el paseo en curso por mascota era un defecto latente y no una funcionalidad. **`npx expo prebuild -p android`** antes de compilar un APK, o `android/app/build.gradle` seguirá anunciando la versión anterior.

```bash
git add package.json CHANGELOG.md e2e/pets.spec.ts
git commit -m "chore(release): v0.27.0"
```

- [ ] **Step 5: Comprobar la tabla de documentación**

`AGENTS.md` → «Documentation maintenance»: este plan no toca scripts, dependencias, migraciones ni `.env.example`, así que **README no cambia**. `CHANGELOG.md` sí, y va en el paso anterior.

---

## Lo que este plan no hace

- **No toca `supabase/migrations/`.** Tener varias fichas ya funciona en el esquema: `pet_owners` es una tabla de unión y las políticas no cuentan filas. Lo que faltaba era que la app eligiera.
- **No avisa de que la otra mascota tiene un paseo en marcha.** Aceptado en la spec §12.2 para esta versión.
- **No reparte accesos.** Eso es el resto de `docs/specs/2026-10-26-compartir-la-ficha-design.md`, y son los planes siguientes.
