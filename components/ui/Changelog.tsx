import { Fragment } from "react";
import { ScrollView, View } from "react-native";
import { CHANGELOG } from "../../lib/changelog.generated";
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
 * Just enough Markdown to read `CHANGELOG.md`, and no more.
 *
 * **A parser would be the wrong shape of answer.** One file, written by us, in
 * a format we choose: four constructs cover all of it — a `##` version, a
 * `###` heading, a `- ` bullet, and a paragraph, with `**bold**` inline. A
 * dependency for that would ship a general-purpose renderer to display one
 * document whose author is in this repo.
 *
 * The rule it imposes in exchange: **if it does not render here, it does not
 * belong in the changelog.** Tables, links and code fences are not part of the
 * vocabulary, which is a fine constraint on a file whose job is to say what
 * changed in sentences.
 */
function Inline({ text }: { text: string }) {
  // Split on both marks at once, keeping the delimiters, so a run knows which
  // one opened it. Anything unbalanced simply reads as plain text — the file
  // is written by us and a stray asterisk is not worth a parser.
  const runs = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {runs.map((run, index) => {
        if (run.startsWith("**") && run.endsWith("**")) {
          return (
            <Text key={index} className="font-semibold text-text-primary">
              {run.slice(2, -2)}
            </Text>
          );
        }
        // Backticks name a symbol — a prop, a file, a class. Dropping the
        // marks and keeping the tone says the same thing without turning a
        // sentence into source code.
        if (run.startsWith("`") && run.endsWith("`")) {
          return (
            <Text key={index} className="text-text-primary">
              {run.slice(1, -1)}
            </Text>
          );
        }
        return <Fragment key={index}>{run}</Fragment>;
      })}
    </>
  );
}

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
