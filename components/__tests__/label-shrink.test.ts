import { readFileSync } from "node:fs";

/**
 * `numberOfLines` does not narrow a box. It only ellipsizes one that is
 * already narrow.
 *
 * `flexShrink` is 0 by default in React Native, so a label wider than the
 * control holding it does not get cut short — it walks out of the `Pressable`
 * and past the border, and `numberOfLines={1}` does nothing about it because
 * there is nothing to ellipsize against. Seen on the device with a 30-char
 * pet name: the red outline of «Borrar la ficha de …» ended halfway through
 * the word, with the rest of the name beyond it.
 *
 * `Button` is where this is worth a guard rather than a comment: it is the
 * primitive every screen composes, its label is frequently a pet's name, and
 * the class is computed, so the one place `shrink` can live is the variable
 * all four of its phases share. `PetSwitcher` carries the same lesson in its
 * own words, on a `className` a reader can see.
 *
 * `Chip` and `Segmented` are deliberately the other way round — their labels
 * are a fixed vocabulary and their boxes carry `shrink-0`, so that a three-up
 * row at font_scale 1.3 wraps instead of breaking a word in half.
 */
const BUTTON = "components/ui/Button.tsx";

describe("Button's label", () => {
  const source = readFileSync(BUTTON, "utf8");

  it("can shrink, so a long one is ellipsized rather than overflowed", () => {
    const labelClass = source.match(/const labelClass = `([^`$]*)/);

    expect(labelClass?.[1]).toMatch(/(^|\s)shrink(\s|$)/);
  });

  it("keeps room beside it for the ellipsis to land in", () => {
    // Without horizontal padding a shrunk label stops exactly on the border,
    // which reads as a rendering fault rather than as a truncation.
    const shapes = source.match(/rounded-xl[^`"]*/g) ?? [];

    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape).toMatch(/\bpx-\d/);
    }
  });
});
