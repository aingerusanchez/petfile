import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A guard against the defect that cost the app its whole touch floor.
 *
 * `Pressable` accepts a callback `style` so it can react to the press state,
 * and it is the obvious place to put `{ minHeight: TOUCH_TARGET }` next to an
 * opacity. **On native, a component given both a `className` and a callback
 * `style` loses the callback entirely.** Measured on device: the floating
 * action rendered 24×24dp — the size of its own icon — because its width,
 * height and radius all travelled that way, and `Cerrar sesión` sat at 36dp
 * against a 48dp floor it was asking for in code. A plain object `style`
 * survives; only the callback form is dropped.
 *
 * Nothing warns. The browser honours the callback, so every one of these
 * looked right in the e2e suite and in every screenshot.
 *
 * The rule: **a plain object for the numbers, `active:` in the class list for
 * the press.** See `PRESSED_OPACITY` in `components/ui/tokens.ts`.
 */
const ROOTS = ["app", "components"];

/** `style={(` — a callback style, whatever it closes over. */
const CALLBACK_STYLE = /style=\{\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(path) ? [path] : [];
  });
}

describe("callback styles", () => {
  const files = ROOTS.flatMap((root) => sources(root));

  it("finds the files it is meant to be checking", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)("keeps %s free of them", (file) => {
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => CALLBACK_STYLE.test(line));

    expect(
      offenders.map(({ number, line }) => `${file}:${number}  ${line}`),
    ).toEqual([]);
  });
});
