import { BookType, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Markdown } from "./Markdown";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { colors, TOUCH_TARGET } from "./tokens";

/**
 * What the note field understands, for whoever wonders.
 *
 * **A sheet rather than a tooltip.** A tooltip is a hover, and there is no
 * hover on a phone; the touch equivalent is a long-press nobody discovers or a
 * bubble that covers the field it explains. This is four lines behind a button
 * that closes four ways, on the field it is about.
 *
 * **It sits in the field's own corner, faint.** It was a "T" stacked above the
 * walk's kaka button, which read as a second control of the sheet rather than
 * as a property of the note — and the two glyphs together did not add up to
 * the textarea's height, so the column beside it was visibly the wrong size.
 * In the corner it belongs to the field, the way the weight chart's maximise
 * mark belongs to the chart; dimmed, because a note's last line runs under it
 * and a mark that hides a word is worse than no mark.
 *
 * **`BookType` rather than a "T".** A letter is what a *formatting* control
 * looks like — bold, italic, a font picker — and this formats nothing: it
 * explains. A book with a T says "how text works here", which is the sentence
 * the sheet then writes out.
 *
 * **It is the only place the vocabulary is written down**, so it shows each
 * construct *and* what it turns into — which is also a live test of the
 * renderer: the examples below are rendered by the same component the notes
 * use, so a construct that stopped working would stop working here too.
 */
const EXAMPLES = `## Un título

**Negrita** para lo importante.

- Una cosa
- Y otra`;

export function MarkdownHelp({ testID }: { testID?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Cómo dar formato a la nota"
        // **The touch target is honest and the mark is small.** 48dp of
        // pressable so a thumb finds it, a 16dp glyph so it does not shout,
        // and no border or fill: it is furniture of the field, not a control
        // sitting on top of one.
        style={{
          minHeight: TOUCH_TARGET,
          minWidth: TOUCH_TARGET,
          opacity: 0.6,
        }}
        className="items-center justify-end pr-1 pb-1 active:opacity-100"
      >
        <BookType size={16} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <Sheet onClose={() => setOpen(false)} testID="markdown-help-sheet">
          {/* The X the picker's sheet already has: four ways out is the
              contract every sheet here keeps, and this one was down to
              three. */}
          <View className="mb-2 flex-row items-center justify-between">
            <Text
              accessibilityRole="header"
              className="font-bold text-lg text-text-primary"
            >
              Dar formato a una nota
            </Text>
            <Pressable
              testID="markdown-help-close"
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              // A literal square, not `h-12 w-12`: those are 3rem, which
              // native resolves to 42dp.
              style={{ width: TOUCH_TARGET, height: TOUCH_TARGET }}
              className="-mr-3 items-center justify-center rounded-xl active:opacity-70"
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text className="mb-5 text-sm text-text-tertiary">
            Se escribe a mano y se ve al leerla. Quien no use nada de esto
            recibe su frase tal cual.
          </Text>

          <View className="mb-5 gap-4">
            {EXAMPLES.split("\n\n").map((block) => (
              <View key={block} className="gap-2">
                {/* What you type, and what it becomes — side by side, because
                    naming a construct without showing its result explains
                    nothing to somebody who has never seen Markdown. */}
                <Text className="font-mono text-xs text-text-tertiary">
                  {block}
                </Text>
                <View className="rounded-xl border border-border-default bg-surface px-4 py-3">
                  <Markdown
                    text={block}
                    className="text-sm text-text-secondary"
                  />
                </View>
              </View>
            ))}
          </View>
        </Sheet>
      ) : null}
    </>
  );
}
