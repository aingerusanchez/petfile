import { Fragment } from "react";
import { View } from "react-native";
import { parseBlocks } from "../../lib/markdown";
import { Text } from "./Text";

/**
 * Just enough Markdown for text a household writes, and no more.
 *
 * **A parser would be the wrong shape of answer.** Five constructs cover
 * everything these callers need — a `###` heading, a `- ` bullet, a `1. `
 * numbered item, a paragraph, and `**bold**` or `` `code` `` inline. A dependency for that would
 * ship a general-purpose renderer to display a vet's note.
 *
 * **It started as the changelog's private renderer**, which is why the
 * vocabulary is the one a changelog needs; a note about a treatment turns out
 * to want exactly the same things — a couple of bold words, a list of
 * symptoms, a blank line between two thoughts.
 *
 * The rule it imposes in exchange: **if it does not render here, it does not
 * belong in the text.** Nested lists, tables, links and code fences are not
 * part of the vocabulary, which is a fine constraint on a field whose job is to say what
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

/** Roughly a digit's advance at `text-sm`, and the dot that follows it. */
const DIGIT_WIDTH = 8;
const DOT_WIDTH = 4;

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
  /**
   * Treat a single newline as a line break rather than as a soft wrap.
   *
   * **For a field where a newline is always deliberate.** A note typed on a
   * phone wraps by accident, which is why Markdown — and this renderer —
   * collapse a lone newline into a space. A clinic's opening hours are the
   * opposite: every line is a different day, nobody breaks one by mistake, and
   * joining them produces "L-V 10:30-14:00 S 10:00-13:00", which is a sentence
   * about nothing. GitHub-flavoured Markdown makes the same exception.
   */
  breaks?: boolean;
  testID?: string;
};

export function Markdown({
  text,
  className = "text-sm text-text-secondary",
  compact = false,
  lines,
  breaks = false,
  testID,
}: MarkdownProps) {
  const blocks = parseBlocks(text);

  if (blocks.length === 0) return null;

  // One paragraph with no formatting is the overwhelmingly common note, and it
  // should be exactly the `Text` it would have been before this existed.
  const gap = compact ? "" : "mb-2";

  return (
    <View testID={testID}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <Text
              key={index}
              className={`mt-2 mb-1 font-semibold text-xs text-accent uppercase ${
                index === 0 ? "mt-0" : ""
              }`}
            >
              {block.text}
            </Text>
          );
        }

        if (block.kind === "bullets" || block.kind === "numbers") {
          // The marker column is as wide as the widest number, right-aligned,
          // so a list that reaches 10 does not push its later items sideways.
          // A digit measures about `DIGIT_WIDTH` at `text-sm`; `DOT_WIDTH` is
          // the dot after it. Both are estimates rather than measurements —
          // too wide only costs a little air, too narrow wraps the item.
          const width =
            String(block.items.length).length * DIGIT_WIDTH + DOT_WIDTH;
          return (
            <View key={index} className={gap}>
              {block.items.map((item, line) => (
                <View key={line} className="flex-row gap-2">
                  {block.kind === "numbers" ? (
                    <Text
                      className={className}
                      style={{ minWidth: width, textAlign: "right" }}
                    >
                      {line + 1}.
                    </Text>
                  ) : (
                    <Text className={className}>·</Text>
                  )}
                  <Text
                    numberOfLines={lines}
                    className={`min-w-0 flex-1 ${className}`}
                  >
                    <Inline text={item} />
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
            <Inline
              text={block.text.replace(/\n[^\S\n]*/g, breaks ? "\n" : " ")}
            />
          </Text>
        );
      })}
    </View>
  );
}
