import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A guard against the one thing `prettier-plugin-tailwindcss` can break.
 *
 * The plugin sorts the classes inside a quoted string and **trims it**, so a
 * fragment that carried its own separator loses it:
 *
 *     `text-text-primary${selected ? " font-bold" : ""}`
 *     → `text-text-primary${selected ? "font-bold" : ""}`
 *
 * which compiles to `text-text-primaryfont-bold` the moment the condition is
 * true. It happened to the chip and the checkbox on the commit that added the
 * plugin, and it is invisible: no error, no warning, just a label that stops
 * being bold.
 *
 * The rule that makes it impossible is to keep the separator in the template
 * literal rather than inside the quotes — `...primary ${cond ? "bold" : ""}`.
 * A trailing space in a class list costs nothing.
 */
const ROOTS = ["app", "components"];

/** A `className={`…x${` with no space before the interpolation. */
const GLUED = /className=\{`[^`]*[^\s`]\$\{/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(path) ? [path] : [];
  });
}

describe("class strings", () => {
  const files = ROOTS.flatMap((root) => sources(root));

  it("finds the files it is meant to be checking", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)("keeps %s's separators outside the quotes", (file) => {
    const offenders = readFileSync(file, "utf8")
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => GLUED.test(line));

    expect(
      offenders.map(({ number, line }) => `${file}:${number}  ${line}`),
    ).toEqual([]);
  });
});
