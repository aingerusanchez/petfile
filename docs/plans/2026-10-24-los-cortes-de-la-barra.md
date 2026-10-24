# Dónde acaba cada paseo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la barra del objetivo marque dónde acabó cada paseo del día, con un corte de 2 dp — generalizando el tick que hoy marca una sola frontera y solo mientras un paseo corre.

**Architecture:** las posiciones se calculan en `lib/goalbar.ts` a partir de las mismas primitivas que ya parten el día en vueltas (`barProgress`, `lapFill`), y se prueban con Jest. `components/ui/GoalBlock.tsx` las dibuja sobre la pista, por encima de las capas del cierre, y retira el tick — que pasa a ser el último de los cortes.

**Tech Stack:** TypeScript estricto, React Native + Reanimated, NativeWind, Jest, Playwright.

**Spec:** `docs/specs/2026-10-24-los-cortes-de-la-barra-design.md`

## Global Constraints

- **`stop` no se toca.** Ha reescrito el inicio de un paseo real dos veces en este proyecto.
- Sin `any`. TypeScript estricto. Sin hex crudos: los colores salen de `components/ui/tokens.ts` o de `global.css`.
- `Text` solo desde `components/ui`. Un `Pressable` nunca lleva `style` de función.
- Los objetivos táctiles salen de `TOUCH_TARGET`, nunca de `min-h-12`.
- **El corte mide 2 dp**, el mismo ancho que el tick que sustituye, que está verificado en el dispositivo.
- **El color del corte es `colors.surface` (`#131C2E`)**, el de la pista.
- **Nunca `pnpm install`. Nunca `--no-verify`. Nunca leer, imprimir ni `grep` el `.env`.**
- Node del proyecto: `nvm use` en la raíz (`.nvmrc`, 24.22.1).
- **Solo una suite de Playwright a la vez en esta máquina**: comparten una cuenta de Supabase y `resetE2EPets()` la vacía.
- Ni bump de versión ni entrada de CHANGELOG fuera de la tarea 3.

## Review Focus

Cinco entradas que la spec implica y que ninguna prueba de tarea ejercita por su cuenta. Cada una lleva su prueba en la tarea que posee el código.

- **Un día con un solo paseo no tiene cortes.** No hay frontera entre dos cosas cuando solo hay una, y un corte en el filo del relleno sería una marca sobre el borde. (Tarea 1)
- **Un paseo que acaba exactamente en el objetivo** cae en la junta de las dos vueltas: ahí no hay nada que separar y el corte se descarta. Es el mismo caso que el tick ya resuelve con «no hay corte donde no hay junta». (Tarea 1)
- **Una mascota sin objetivo** no tiene escala, así que no tiene cortes. (Tarea 1)
- **Un día que pasa del tope de la escala** —más del doble del objetivo— tiene paseos que la barra no puede situar. Se descartan en vez de amontonarse en el filo derecho. (Tarea 1)
- **Durante un paseo en marcha, el último corte es la frontera entre lo grabado y lo que está pasando**, que es exactamente lo que el tick dibujaba. Si el corte no aparece ahí, se ha perdido una marca al retirar el tick, y los dos tonos que separa miden 1,71:1 entre sí. (Tarea 2)

---

### Task 1: Dónde va cada corte

**Files:**

- Modify: `lib/goalbar.ts`
- Test: `lib/__tests__/goalbar.test.ts`

**Interfaces:**

- Consumes: `barProgress`, `barStateAt`, `lapFill`, `TOP_TIER` — ya existen en ese fichero.
- Produces:
  ```ts
  /**
   * Dónde acaba cada paseo del día sobre la pista, en 0–100 del ancho.
   *
   * Recibe los minutos de cada paseo en el orden en que ocurrieron. Devuelve
   * una posición por cada frontera *entre* dos paseos: el último no lleva,
   * porque su final es el filo del relleno y ése ya se ve.
   */
  export function walkCuts(
    walkMinutes: number[],
    goalMinutes: number | null,
  ): number[];
  ```

**Por qué vive aquí y no en el componente:** una posición mal calculada no lanza. Dibuja una marca donde no hubo ningún paseo, y nadie la ve hasta que alguien cuenta los cortes y no le cuadran con la medida. Es la misma razón por la que la escala está en este fichero.

**Una frontera calculada por segunda vía es una barra que corta donde la medida dice otra cosa**, así que esto sale de `barProgress` y `lapFill`, no de aritmética nueva.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/goalbar.test.ts, en un describe("walkCuts")
it("marca las fronteras y no el final del último paseo", () => {
  // Objetivo 120. Tres paseos: 58, 27, 20. Fronteras en 58 y 85.
  expect(walkCuts([58, 27, 20], 120)).toEqual([
    expect.closeTo(48.33, 1),
    expect.closeTo(70.83, 1),
  ]);
});

it("un solo paseo no tiene fronteras", () => {
  expect(walkCuts([58], 120)).toEqual([]);
});

it("sin objetivo no hay escala, así que no hay cortes", () => {
  expect(walkCuts([58, 27], null)).toEqual([]);
});

it("sitúa en su vuelta los paseos que pasan del objetivo", () => {
  // 58, 27, 44, 35 → fronteras en 58, 85 y 129. La tercera es la segunda
  // vuelta: 9 de 120, el 7,5% de la pista, a la izquierda de las otras dos.
  expect(walkCuts([58, 27, 44, 35], 120)).toEqual([
    expect.closeTo(48.33, 1),
    expect.closeTo(70.83, 1),
    expect.closeTo(7.5, 1),
  ]);
});

it("descarta la frontera que cae justo en la junta de dos vueltas", () => {
  // 58 + 62 = 120 exactos: ahí no hay nada que separar, y el corte caería
  // sobre el filo de la pista.
  expect(walkCuts([58, 62, 30], 120)).toEqual([expect.closeTo(48.33, 1)]);
});

it("descarta lo que no cabe en la escala", () => {
  // La barra llega al doble del objetivo y no más. Un paseo que acaba más
  // allá no se amontona en el filo derecho: no se dibuja.
  expect(walkCuts([130, 130, 60], 120)).toEqual([expect.closeTo(8.33, 1)]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest lib/__tests__/goalbar.test.ts -t walkCuts`
Expected: FAIL — `walkCuts is not a function`.

- [ ] **Step 3: Implement `walkCuts` en `lib/goalbar.ts`**

Acumula los minutos, descarta el último, y para cada acumulado pide su sitio a las primitivas que ya existen. Docblock en la voz del fichero: qué decide, y por qué una frontera en la junta o fuera de escala se descarta en vez de recortarse.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest lib/__tests__/goalbar.test.ts` — y el fichero entero, no solo el `describe` nuevo: las pruebas de `closeMotion` y `closeLaps` tienen que devolver exactamente lo que devolvían.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/goalbar.ts lib/__tests__/goalbar.test.ts
git commit -m "feat(goalbar): dónde acaba cada paseo sobre la pista"
```

---

### Task 2: La barra los dibuja, y el tick se retira

**Files:**

- Modify: `components/ui/GoalBlock.tsx`, `app/(tabs)/index.tsx` (pasarle los minutos por paseo)
- Test: `e2e/home.spec.ts`

**Interfaces:**

- Consumes: `walkCuts` de la tarea 1.
- El bloque necesita **los minutos de cada paseo en orden**, que hoy no recibe: hoy recibe el total (`Walked`). Mira cómo el día construye `shown` y añade la lista por el mismo camino, sin cambiar lo que ya viaja.

**Lo que hay que respetar, y cada una ha costado algo en este fichero:**

- **Los cortes van por encima de las capas del cierre.** La ceremonia pinta sobre toda la barra durante 760 ms; unos cortes por debajo desaparecerían ese rato y volverían al acabar.
- **El tick sale, y el corte ocupa su sitio.** Su docblock explica por qué existe —Mist contra el tono del tramo en curso miden 1,71:1— y por qué no es un pomo ni pulsa. Esas razones siguen valiendo para el corte: hereda las reglas, no el código. Lee ese docblock entero antes de borrar nada y llévate a `walkCuts` o al corte lo que siga siendo cierto.
- **No hay corte donde no hay junta**: nada grabado en la vuelta en curso es un corte colgando del filo izquierdo.
- `GoalBlock` ya dibuja porcentajes animados en nativo; el corte es estático y no necesita animarse.

- [ ] **Step 1: Write the failing tests**

```ts
// e2e/home.spec.ts
test("marca dónde acabó cada paseo, menos el último", async ({ page }) => {
  // Tres paseos sembrados en un día pasado, donde una hora fija ya ocurrió.
  // Dos cortes: el tercero acaba en el filo del relleno.
  await expect(page.getByTestId("home-goal-cut")).toHaveCount(2);
});

test("conserva los cortes de la vuelta cumplida", async ({ page }) => {
  // Cuatro paseos que cruzan el objetivo. Tres cortes, y uno de ellos a la
  // izquierda de los otros dos porque es de la segunda vuelta.
  await expect(page.getByTestId("home-goal-cut")).toHaveCount(3);
});

test("un día de un solo paseo no lleva ningún corte", async ({ page }) => {
  await expect(page.getByTestId("home-goal-cut")).toHaveCount(0);
});

test("durante un paseo, el último corte es la frontera de lo grabado", async ({
  page,
}) => {
  // Un paseo grabado y otro en marcha: un corte, y está donde estaba el
  // tick. Es la prueba de que retirar el tick no perdió la marca.
  await expect(page.getByTestId("home-goal-cut")).toHaveCount(1);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test e2e/home.spec.ts -g "corte"`
Expected: FAIL — no existe `home-goal-cut`.

- [ ] **Step 3: Dibujar los cortes y retirar el tick**

- [ ] **Step 4: Run**

Run: `npx playwright test e2e/home.spec.ts` entero — las pruebas del tick, del cierre y del barrido son las que dirán si retirarlo rompió algo.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/GoalBlock.tsx "app/(tabs)/index.tsx" e2e/home.spec.ts
git commit -m "feat(home): la barra marca dónde acabó cada paseo"
```

---

### Task 3: Enviarlo

**Files:**

- Modify: `package.json`, `CHANGELOG.md`, `lib/changelog.generated.ts`, `docs/specs/2026-10-24-los-cortes-de-la-barra-design.md`

- [ ] **Step 1: Bump a `0.25.0` y escribir la entrada**

Lo que cambió y por qué lo anterior estaba incompleto: la barra decía cuánto y no en qué trozos, mientras las palabras de encima ya contaban los paseos. Y que el tick no se ha sustituido por otra cosa — se ha generalizado.

- [ ] **Step 2: Marcar la spec como construida**, con lo que se haya medido en el teléfono.

- [ ] **Step 3: Verificar**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`

- [ ] **Step 4: Commit**

```bash
git add package.json CHANGELOG.md lib/changelog.generated.ts docs/specs/2026-10-24-los-cortes-de-la-barra-design.md
git commit -m "chore(release): v0.25.0"
```

**No termina en un teclado.** En el teléfono hay que ver cuatro cosas, y las tres primeras son las que la spec deja abiertas a propósito: que un corte de 2 dp se vea sobre las cuatro superficies donde puede caer; que cuatro o cinco cortes no lean como barra a rayas; qué pasa con dos paseos cuyos cortes caen a menos de 2 dp; y que el corte oscuro separe lo grabado de lo que está pasando al menos tan bien como lo hacía el tick blanco, que es un cambio sobre algo ya enviado.
