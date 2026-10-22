# La parada del paseo no depende de la cobertura — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulsar PARAR sin cobertura cierra el paseo igualmente: la intención se guarda en el teléfono con la hora real de la pulsación y se sube sola en cuanto hay red.

**Architecture:** Una cola en `AsyncStorage` junto al paseo en curso, con la lógica pura en `lib/pending.ts` y la reproducción al lado. La rama de error de `stop` deja de limitarse a avisar: encola y suelta el paseo. El día cuenta los minutos pendientes como propios —actualización optimista— y la fila los marca como aún no subidos. Nada detecta la conectividad: se reintenta al volver a la app, tras cualquier lectura que salga bien, y con el Reintentar.

**Tech Stack:** Expo SDK 57 · React Native 0.86 · `@react-native-async-storage/async-storage` · Supabase · Jest para `lib/` · Playwright para los flujos.

**Spec:** `docs/specs/2026-10-21-offline-walk-design.md`

## Global Constraints

- **La decisión 2 de la spec ya está construida** y este plan no la toca: un paseo en marcha sobrevive a que la app muera, porque vive en `AsyncStorage` desde que empieza. Se nombra para que nadie la busque aquí.
- **Alcance: solo la parada.** El arranque sin cobertura queda fuera — la fila ya existe en el servidor, así que la cola guarda una intención sobre una fila conocida. Un arranque encolado exigiría identidad local y reconciliación entre los dos teléfonos.
- **El principio que ordena la spec:** _la app usa lo que sabe y no rellena lo que no sabe._ La hora de fin es la de la pulsación porque el teléfono la registró; lo que no tenga registrado, no se inventa.
- **Nada se descarta en silencio.** Un elemento que no sube se reintenta; el único caso en que se retira es cuando el servidor dice que la intención ya no puede cumplirse, y entonces se dice.
- **Sin detector de conectividad.** Ya se descartó: la app no sabe si hay red, solo descubre que una petición ha fallado.
- `stop` en `app/(tabs)/index.tsx` **ha reescrito el inicio de un paseo real dos veces en la historia de este proyecto.** Toda tarea que lo toque se sostiene en "ninguna línea existente movida salvo las que el cambio exige", y nombra cuáles en su informe.
- AGENTS.md completo: sin `any`, `Text` solo desde `components/ui`, colores solo de los tokens, nada de `style` de función en un `Pressable`, el separador de una lista de clases nunca dentro de las comillas, Conventional Commits, nunca `--no-verify`, nunca `pnpm install`.

## Review Focus

- **La fila desapareció del servidor mientras la parada estaba pendiente** (el otro tutor la borró). El reintento recibe un rechazo, no un fallo de red: esa intención no puede cumplirse nunca y es el único caso en que se retira — diciéndolo.
- **Dos paradas pendientes del mismo paseo.** No puede haber dos paseos a la vez en un teléfono, pero sí dos pulsaciones sobre el mismo: la segunda sustituye a la primera en vez de añadirse.
- **La app se cierra con una parada pendiente.** La cola está en disco; al abrir, el paseo ya no está en marcha y sus minutos cuentan desde el primer render.
- **El otro tutor cerró el mismo paseo mientras esta parada estaba pendiente.** La fila ya tiene duración: el reintento la sobrescribiría con la nuestra. Decidir y probar cuál gana.
- **El tutor edita un paseo cuya parada está pendiente.** La fila existe y se puede tocar: la hoja abre y deja mover DESDE. Los `minutes` que la cola guardó se calcularon contra el inicio viejo y dejan de corresponder a nada. `pressedAt` es lo que permite recalcularlos — y es la razón por la que ese campo se queda aunque hoy nadie lo lea en tiempo de ejecución.
- **La reproducción corre dos veces a la vez** — volver a la app y una lectura que termina bien pueden coincidir. Un elemento no puede subirse dos veces.

---

### Task 1: La cola, y lo que la hace de fiar

**Files:**

- Create: `lib/pending.ts`
- Test: `lib/__tests__/pending.test.ts`

**Interfaces:**

- Produces:
  ```ts
  export const PENDING_STORAGE_KEY = "petfile.pending.v1";
  export type PendingStop =
    | { kind: "close"; id: string; minutes: number; pressedAt: string }
    | { kind: "delete"; id: string; pressedAt: string };
  export function parsePending(raw: string | null): PendingStop[];
  export function serialisePending(queue: PendingStop[]): string;
  export function enqueueStop(
    queue: PendingStop[],
    item: PendingStop,
  ): PendingStop[];
  export function withoutStop(queue: PendingStop[], id: string): PendingStop[];
  export function pendingMinutes(queue: PendingStop[]): number;
  export function pendingWalks(queue: PendingStop[]): number;
  ```

`pressedAt` es un instante ISO y es **el dato que justifica todo**: es la hora en que el tutor pulsó, registrada por el teléfono. `minutes` ya se calculó contra ella, así que reproducir la intención no vuelve a mirar el reloj.

- [ ] **Step 1: Write the failing tests**

```ts
it("sobrevive a cualquier basura en el almacenamiento", () => {
  // null, "", "{]", "[]", un objeto que no es lista, una lista con un
  // elemento sin id → [] en todos los casos, nunca una excepción.
});
it("una segunda parada del mismo paseo sustituye a la primera", () => {
  // enqueueStop con el mismo id dos veces → longitud 1, el segundo gana.
});
it("suma los minutos pendientes y cuenta los paseos", () => {
  // dos close de 30 y 12 y un delete → pendingMinutes 42, pendingWalks 2.
  // Un delete no aporta minutos ni cuenta como paseo: no habrá fila.
});
it("va y vuelve del texto sin perder nada", () => {
  // parsePending(serialisePending(q)) es igual a q.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest lib/__tests__/pending.test.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implement `lib/pending.ts`**

Sigue el patrón de `lib/walk.ts`, que ya hace esto mismo para el paseo en curso: parseo defensivo, clave versionada, nada que lance.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest lib/__tests__/pending.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pending.ts lib/__tests__/pending.test.ts
git commit -m "feat(pending): la cola de paradas, y lo que la hace de fiar"
```

---

### Task 2: Una parada que falla se guarda en vez de perderse

**Files:**

- Modify: `app/(tabs)/index.tsx` (la rama de error de `stop`, y la carga inicial)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: todo lo de Task 1.
- Produces: estado `pending: PendingStop[]` en el día, y la cola leída de disco al montar junto al paseo en curso.

**Lo que cambia en `stop`.** Hoy la rama de error hace tres cosas —toast, `setFailed`, `return`— y el comentario sobre ella dice _"The walk stays running so the tutor can press stop again"_. Esa frase deja de ser verdad y se va con el código.

Ahora: el toast y el temblor **se quedan** —el tutor debe saber que no hubo red— y además la intención se encola, el paseo se suelta (`runningId` a null, la clave del paseo en curso borrada) y `attempt` se bumpea. El paseo deja de estar en marcha porque el tutor lo paró; lo que falta es subirlo.

**El orden importa y ya costó un defecto aquí:** la escritura en disco de la cola va **después** de los `set…`, por la misma razón que el comentario existente da para `setClosed` — un `await` entre dos actualizaciones rompe el lote de React y deja commitar un render a medias.

- [ ] **Step 1: Write the failing test**

```ts
test("una parada sin red deja el paseo guardado para después", async ({
  page,
}) => {
  // Paseo en marcha, se cortan todas las rutas, se pulsa parar:
  // el toast sale, el control vuelve a "Paseo" (ya no está en marcha),
  // y al recargar la página la cola sigue ahí — el paseo no volvió a
  // aparecer como en marcha.
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "guardado para después"`
Expected: FAIL — hoy el control sigue siendo el de parar.

- [ ] **Step 3: Encolar en la rama de error, y leer la cola al montar**

- [ ] **Step 4: Run the walk specs**

Run: `npx playwright test e2e/home.spec.ts -g "guardado para después|paseo|stop|offline"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(home): una parada sin red se guarda en vez de perderse"
```

---

### Task 3: El día cuenta lo que está pendiente

**Files:**

- Modify: `app/(tabs)/index.tsx` (donde se construye `walked`)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: `pendingMinutes`, `pendingWalks` de Task 1; el estado `pending` de Task 2.

Esto es la actualización optimista, y sin ella la Task 2 es una regresión: hoy una parada fallida deja el paseo en marcha y sus minutos vivos siguen contando, así que la barra no lo pierde. En cuanto el paseo se suelta, **los minutos pendientes tienen que ocupar su sitio o la barra retrocede** — que es exactamente el fotograma que la v0.15.0 se gastó en eliminar.

El bloque del objetivo lee un solo valor `Walked { minutes, walks }`. Los pendientes se suman ahí, antes de que el bloque lo vea, para que no haya dos sitios que puedan discrepar.

- [ ] **Step 1: Write the failing test**

```ts
test("la barra no retrocede cuando la parada se queda pendiente", async ({
  page,
}) => {
  // Muestrea el ancho pintado a cada frame desde la pulsación: nunca cae
  // por debajo de lo que medía al pulsar, y la medida pasa de
  // "X en N paseos" a "X+duración en N+1 paseos".
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "no retrocede cuando la parada"`
Expected: FAIL.

- [ ] **Step 3: Sumar los pendientes al `Walked` del día**

- [ ] **Step 4: Run the bar specs**

Run: `npx playwright test e2e/home.spec.ts -g "no retrocede|barra|medida|objetivo"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(home): los minutos pendientes son minutos del día"
```

---

### Task 4: La fila dice que aún no ha subido

**Files:**

- Modify: `app/(tabs)/index.tsx` (`Entry`)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: el estado `pending` de Task 2.

Hoy, tras una parada fallida, la fila dice **`En marcha`** — y eso ya es mentira: el tutor la paró. Con la cola, la fila muestra su duración como cualquier otra y lleva una marca de que no está subida.

**La marca, decidida sobre el prototipo del tablero (opción B).** Un glifo `CloudOff` de Lucide **delante del título**, en `text-warning`, dentro de la misma línea que la palabra. Nada más cambia de tono.

**Va delante del título y no en el borde derecho**, que es donde vive la marca de la kaka. Esa marca habla del **paseo**; esta habla del **registro**. Pegada al título se lee como una propiedad de la fila en vez de un dato del animal.

**Sin estado envejecido.** Se consideró y se descartó: _el problema es que no se ha sincronizado, no desde cuándo_. Con eso desaparecen `agedPending`, la condición del color y la variante del texto hablado.

**Y la opción A se descartó con una medición.** Atenuar la fila entera exigía bajar la hora a `text-muted`, que mide **3,96:1** y falla AA; subirla a `text-tertiary` para que se lea deja el escalón en 17,19:1 → 12,68:1, una diferencia que existe en la tabla y casi no en la pantalla.

**Un icono no es una razón**, así que la palabra va en el nombre accesible: la fila añade `no sincronizado`. Es el texto más técnico de la app y es deliberado: se dice en voz alta, y ahí importa más que quede claro que falta una subida —no que se haya perdido un dato— que el tono de la casa.

- [ ] **Step 1: Write the failing test**

```ts
test("un paseo sin subir lleva su marca y dice por qué", async ({ page }) => {
  // Tras la parada sin red: la fila muestra la duración (no "En marcha"),
  // existe el testID de la marca, y el nombre accesible contiene
  // "no sincronizado".
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/home.spec.ts -g "sin subir lleva su marca"`
Expected: FAIL.

- [ ] **Step 3: Dibujar la marca en `Entry`**

- [ ] **Step 4: Run the entry specs**

Run: `npx playwright test e2e/home.spec.ts -g "sin subir|entrada|registro"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(home): un paseo sin subir lo dice"
```

---

### Task 5: Sube sola en cuanto hay red

**Files:**

- Modify: `lib/pending.ts` (la reproducción), `app/(tabs)/index.tsx` (los tres disparadores)
- Test: `lib/__tests__/pending.test.ts`, `e2e/home.spec.ts`

**Interfaces:**

- Produces:
  ```ts
  /**
   * Reproduce la cola. Devuelve los elementos que siguen pendientes y los
   * que el servidor rechazó de forma definitiva, que son cosas distintas.
   */
  export async function flushPending(
    queue: PendingStop[],
  ): Promise<{ left: PendingStop[]; rejected: PendingStop[] }>;
  ```

**Sin reintento manual, y la razón no es que ya haya disparadores.** Un botón solo ayuda si los automáticos no se están disparando; si se disparan y fallan, pulsarlo hace lo mismo y falla igual, porque el problema es la red. Lo que lo reabriría es ver la marca sobrevivir a varias aperturas de la app con cobertura — y entonces el arreglo serían los disparadores, no un botón.

**Tres disparadores, ninguno es un detector de red:** volver a la app (`AppState`), cualquier lectura del día que termine bien, y el `Reintentar` del registro. Los tres son momentos en que hay motivo para creer que la red ha vuelto.

**Un fallo de red y un rechazo del servidor no son lo mismo.** Un fallo de red deja el elemento en `left` y se reintentará. Un rechazo —la fila ya no existe porque el otro tutor la borró— va a `rejected`: esa intención no podrá cumplirse nunca, se retira de la cola **y se dice con un toast**, porque la regla es que nada se descarta en silencio.

**Dos reproducciones a la vez no pueden subir lo mismo dos veces.** Un `ref` de "ya estoy reproduciendo" basta, y es la misma guarda que `walkInFlight` ya usa para las pulsaciones.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/pending.test.ts — con el cliente simulado
it("deja en la cola lo que falló por red", () => {});
it("retira lo que el servidor rechazó, y lo dice aparte", () => {});
it("no sube dos veces aunque se reproduzca dos veces a la vez", () => {
  // Dos flushPending solapados sobre la misma cola: una sola escritura
  // por elemento. Es el caso de volver a la app justo cuando una lectura
  // termina bien, y los dos disparadores son reales.
});
it("la fila que el otro tutor ya cerró no se sobrescribe", () => {
  // La fila tiene duración y no es la nuestra: la intención se retira
  // como cumplida, no se reintenta y no pisa el dato ajeno. Lo que llegó
  // primero gana, que es la única regla que no exige adivinar.
});

// e2e/home.spec.ts
test("sube la parada pendiente en cuanto vuelve la red", async ({ page }) => {
  // Parada sin red, se restaura la ruta, se pulsa Reintentar: la marca
  // desaparece, la fila queda como cualquier otra, y la medida no cambia
  // — ya contaba esos minutos.
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest lib/__tests__/pending.test.ts` y `npx playwright test e2e/home.spec.ts -g "en cuanto vuelve la red"`
Expected: FAIL.

- [ ] **Step 3: Implement `flushPending` y engancharlo a los tres disparadores**

- [ ] **Step 4: Run everything that touches the queue**

Run: `npx jest lib/__tests__/pending.test.ts` y `npx playwright test e2e/home.spec.ts -g "pendiente|sin subir|vuelve la red|Reintentar"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pending.ts lib/__tests__/pending.test.ts "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(pending): la parada sube sola en cuanto hay red"
```

---

### Task 6: Enviarlo

**Files:**

- Modify: `package.json`, `CHANGELOG.md`, `PRODUCT.md`, `docs/specs/2026-10-21-offline-walk-design.md`, `AGENTS.md` si la arquitectura lo pide

- [ ] **Step 1: Bump a `0.22.0` y escribir la entrada**

Lo que cambió y por qué lo anterior estaba mal, con el número: parar en el portal sin cobertura obligaba a volver a pulsar al llegar a casa, **y la segunda pulsación escribía esa hora** — veinte minutos de ascensor y escaleras entraban como paseo.

- [ ] **Step 2: `PRODUCT.md`**

La entrada de "una acción fallida no es una navegación fallida" describe el parar fallido como algo que el tutor repite. Ya no. Y el alcance —solo la parada— se registra con su razón, para que nadie lea esto como que el arranque también está cubierto.

- [ ] **Step 3: La spec, marcada como construida**

Sus cuatro decisiones siguen siendo las vigentes; lo que cambia es que las tres secciones abiertas ("lo que este documento no decide") ya tienen respuesta. Escribirla allí.

- [ ] **Step 4: Verificar**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`

- [ ] **Step 5: Commit**

```bash
git add package.json CHANGELOG.md lib/changelog.generated.ts PRODUCT.md docs/specs/2026-10-21-offline-walk-design.md
git commit -m "chore(release): v0.22.0"
```

**No termina en un teclado.** En el teléfono hay que ver: la marca de pendiente y su forma envejecida, que la barra no retroceda al pulsar parar sin red, y la subida al volver la cobertura de verdad — no con una ruta cortada, sino saliendo de casa.
