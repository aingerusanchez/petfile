import { ScrollView, View } from "react-native";
import { CHANGELOG } from "../../lib/changelog.generated";
import { Inline } from "./Markdown";
import { Text } from "./Text";

/**
 * What the running build changed.
 *
 * **Generated into a module rather than carried in `app.config`'s `extra`.**
 * The commit hash rides there happily; 5KB of changelog does not arrive on
 * the web target at all — measured, with the value present in
 * `expo config --type public` and absent from `Constants.expoConfig` in the
 * running app. `scripts/changelog.mjs` writes the module from the same
 * Markdown, and a test fails when the two drift.
 */
export const APP_CHANGELOG: string | null = CHANGELOG || null;

/**
 * The changelog's own blocks, on top of the shared inline renderer.
 *
 * **The vocabulary moved to `Markdown` the day a treatment note wanted it.**
 * What stays here is what is true of this document and of nothing else: the
 * `##` version heading, the `# ` title the sheet already shows, and the HTML
 * comments that are notes to whoever edits the file.
 */
export function Changelog({ testID }: { testID?: string }) {
  if (!APP_CHANGELOG) return null;

  // Blank lines separate blocks; a block's own newlines are soft wraps, which
  // is how the file is written and how Markdown reads it.
  const blocks = APP_CHANGELOG.split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <ScrollView
      testID={testID}
      // Capped so the panel cannot grow past the screen on a long history,
      // and the sheet's own padding keeps it clear of the status bar.
      style={{ maxHeight: 460 }}
      showsVerticalScrollIndicator={false}
    >
      {blocks.map((block, index) => {
        // The sheet has its own title, and an HTML comment is a note to
        // whoever edits the file — neither is for the reader.
        if (block.startsWith("# ") || block.startsWith("<!--")) return null;

        if (block.startsWith("## ")) {
          return (
            <Text
              key={index}
              accessibilityRole="header"
              className="mt-5 mb-2 font-bold text-lg text-text-primary"
            >
              {block.slice(3).replace(/[[\]]/g, "")}
            </Text>
          );
        }

        if (block.startsWith("### ")) {
          return (
            <Text
              key={index}
              className="mt-3 mb-1 font-semibold text-xs text-accent-secondary uppercase"
            >
              {block.slice(4)}
            </Text>
          );
        }

        if (block.startsWith("- ")) {
          return (
            <View key={index} className="mb-2">
              {block.split(/\n(?=- )/).map((item, line) => (
                <View key={line} className="mb-2 flex-row gap-2">
                  <Text className="text-text-tertiary">·</Text>
                  <Text className="flex-1 text-sm text-text-secondary">
                    <Inline
                      text={item.replace(/^- /, "").replace(/\n\s+/g, " ")}
                    />
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={index} className="mb-3 text-sm text-text-secondary">
            <Inline text={block.replace(/\n\s*/g, " ")} />
          </Text>
        );
      })}
    </ScrollView>
  );
}
