import { Fragment } from "react";
import { View } from "react-native";
import { Text } from "./Text";

/**
 * Just enough Markdown for text a household writes, and no more.
 *
 * **A parser would be the wrong shape of answer.** Four constructs cover
 * everything these two callers need — a `###` heading, a `- ` bullet, a
 * paragraph, and `**bold**` or `` `code` `` inline. A dependency for that would
 * ship a general-purpose renderer to display a vet's note.
 *
 * **It started as the changelog's private renderer**, which is why the
 * vocabulary is the one a changelog needs; a note about a treatment turns out
 * to want exactly the same things — a couple of bold words, a list of
 * symptoms, a blank line between two thoughts.
 *
 * The rule it imposes in exchange: **if it does not render here, it does not
 * belong in the text.** Tables, links and code fences are not part of the
 * vocabulary, which is a fine constraint on a field whose job is to say what
 * the vet said.
 *
 * **Nothing here is an editor.** The note is typed into a plain multiline
 * field: no toolbar, no preview, no live formatting. Somebody who writes
 * asterisks gets bold and somebody who does not gets their sentence back
 * unchanged, which is the whole bargain of writing Markdown by hand.
 */
export function Inline({ text }: { text: string }) {
  // Split on both marks at once, keeping the delimiters, so a run knows which
  // one opened it. Anything unbalanced simply reads as plain text — a stray
  // asterisk in a hurried note is not worth a parser.
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
        // Backticks name a thing — a dose, a product, a symbol. Dropping the
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

type MarkdownProps = {
  text: string;
  /** The tone of an ordinary paragraph. Headings and bold step up from it. */
  className?: string;
  /** Rendered instead of a paragraph's own spacing, for a compact list row. */
  compact?: boolean;
  /**
   * Cap each block at this many lines.
   *
   * **For a section that summarises rather than holds.** A tutor pasting a
   * vet's whole protocol into one note — the dose, the three medicines, the
   * hours between them — is doing exactly the right thing, and a read-back
   * list that renders all five lines of it stops being a list. The full text
   * is one tap away on the day it belongs to.
   */
  lines?: number;
  testID?: string;
};

export function Markdown({
  text,
  className = "text-sm text-text-secondary",
  compact = false,
  lines,
  testID,
}: MarkdownProps) {
  // Blank lines separate blocks; a block's own newlines are soft wraps, which
  // is how somebody types into a phone and how Markdown reads it.
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  // One paragraph with no formatting is the overwhelmingly common note, and it
  // should be exactly the `Text` it would have been before this existed.
  const gap = compact ? "" : "mb-2";

  return (
    <View testID={testID}>
      {blocks.map((block, index) => {
        if (block.startsWith("### ") || block.startsWith("## ")) {
          return (
            <Text
              key={index}
              className={`mt-2 mb-1 font-semibold text-xs text-accent-secondary uppercase ${
                index === 0 ? "mt-0" : ""
              }`}
            >
              {block.replace(/^#{2,3} /, "")}
            </Text>
          );
        }

        if (block.startsWith("- ")) {
          return (
            <View key={index} className={gap}>
              {block.split(/\n(?=- )/).map((item, line) => (
                <View key={line} className="flex-row gap-2">
                  <Text className={className}>·</Text>
                  <Text
                    numberOfLines={lines}
                    className={`min-w-0 flex-1 ${className}`}
                  >
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
          <Text
            key={index}
            numberOfLines={lines}
            className={`${className} ${index === blocks.length - 1 ? "" : gap}`}
          >
            <Inline text={block.replace(/\n\s*/g, " ")} />
          </Text>
        );
      })}
    </View>
  );
}
