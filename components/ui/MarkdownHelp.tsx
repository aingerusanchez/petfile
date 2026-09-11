import { Type } from "lucide-react-native";
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
 * that closes four ways, next to the field it is about.
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
        style={{ minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET }}
        className="items-center justify-center rounded-xl border border-border-default bg-surface active:opacity-70"
      >
        <Type size={18} color={colors.textTertiary} />
      </Pressable>

      {open ? (
        <Sheet onClose={() => setOpen(false)} testID="markdown-help-sheet">
          <Text
            accessibilityRole="header"
            className="mb-2 font-bold text-lg text-text-primary"
          >
            Dar formato a una nota
          </Text>
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
