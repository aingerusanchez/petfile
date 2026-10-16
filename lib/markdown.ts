/**
 * The block structure of a note: which of four shapes each stretch of text is.
 *
 * **Lives in `lib/` for the reason `framing.ts` does.** Telling a numbered list
 * from a paragraph is a regular expression, and a wrong one does not throw —
 * it renders a vet's protocol as one run-on sentence, or eats the first word
 * of an item. A pure function can be tested with a dozen strings in a few
 * milliseconds; the component that draws the result cannot.
 *
 * Four shapes and no more: a `##`/`###` heading, a `- ` list, a `1. ` list and
 * a paragraph. **Nested lists, links and tables stay out**, each for the same
 * reason — they are a parser rather than a branch, and nothing in this
 * project has wanted one.
 */
export type Block =
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbers"; items: string[] }
  | { kind: "paragraph"; text: string };

/** A line that opens a numbered item: `1. `, `12. ` — digits, a dot, a space. */
const NUMBERED = /^\d+\. /;

/**
 * A list item's own newlines are soft wraps, which is how somebody types into
 * a phone and how Markdown reads it. A continuation line (indented or not) is
 * folded into the item it follows.
 */
function item(text: string, marker: RegExp): string {
  return text.replace(marker, "").replace(/\n\s+/g, " ");
}

export function parseBlocks(text: string): Block[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block): Block => {
      if (block.startsWith("### ") || block.startsWith("## ")) {
        return { kind: "heading", text: block.replace(/^#{2,3} /, "") };
      }

      if (block.startsWith("- ")) {
        return {
          kind: "bullets",
          items: block.split(/\n(?=- )/).map((line) => item(line, /^- /)),
        };
      }

      // **The numbers it will draw are its own, not the typed ones**, and that
      // is deliberate: the marker is stripped here and the renderer counts from
      // one. A list typed 1, 1, 1 — the way Markdown itself allows, and the way
      // a hurried tutor types it — or 1, 3, 4 after an item was deleted still
      // reads in order. Somebody will one day see the typed number discarded
      // and "fix" it; what they would be fixing is a protocol that reads
      // "1. 3. 4." on the screen of a person giving a dog its medicine.
      if (NUMBERED.test(block)) {
        return {
          kind: "numbers",
          items: block
            .split(/\n(?=\d+\. )/)
            .map((line) => item(line, NUMBERED)),
        };
      }

      return { kind: "paragraph", text: block };
    });
}
