/**
 * How long a note may be, and what "may be" means for text that is already
 * longer.
 *
 * **500, chosen against the household's own notes.** The longest one on record
 * is about 200 characters — a paragraph about a dog that got into the
 * bathroom — so 500 is roomy for everything they write and a real ceiling for
 * what they do not: a vet's whole discharge letter pasted in. A limit nobody
 * can approach is decoration; this one can be reached, which is the point of a
 * counter. The walk's note used to stop at 200, which was the same paragraph
 * hitting a wall the tutor did not know was there.
 */
export const NOTE_LIMIT = 500;

/** The counter stays out of the way until this share of the limit is used. */
const COUNTER_FROM = 0.8;

/**
 * Whether the counter is drawn.
 *
 * **Late, and then permanently.** Always-on would put `0/500` under every note
 * field in the app for the sake of the one note in a hundred that gets near
 * it. Late is quiet, and 80% still leaves a hundred characters — a couple of
 * sentences — to finish a thought before the field stops. **An over-length
 * note shows it too**: a row written before the limit existed has to say why
 * the field will not grow, not look like a field that is broken.
 */
export function showsCounter(length: number, limit: number): boolean {
  return length >= Math.ceil(limit * COUNTER_FROM);
}

/** The field has no more room: it is full, or was already past full. */
export function atLimit(length: number, limit: number): boolean {
  return length >= limit;
}

/**
 * The value a note field should take after the person typed `next` over
 * `previous`.
 *
 * **Not `maxLength` alone, because it cannot tell a note that is too long
 * from a note that is being edited.** On a controlled input the platform's own
 * cap is a filter on the view's text, and a filter does not ask where the text
 * came from: Android's runs on the value the app *sets* as well as on what is
 * typed, so a longer note could be cut as it is written into the view while
 * the state still holds all of it — a saved note silently diverging from what
 * the screen showed. (Reasoned from the platform's behaviour, not measured on
 * a device; the design below does not depend on it being right.) Rewriting rows was ruled out, so what binds is
 * what is typed *from now on*:
 *
 * - a change that does not grow the text is always taken, whatever the length —
 *   a 600-character note can be shortened, corrected, or have a word swapped;
 * - a change that grows it is taken up to the limit and no further. A paste
 *   that does not fit is cut at the limit **where it was inserted**, not at the
 *   end of the note, so the text already there is never what gets lost.
 *
 * Lengths are UTF-16 units, as the platforms count them. A pile-of-poo emoji —
 * the habit the walk's kaka button replaced — is two, and is never cut in half.
 */
export function clampToLimit(
  previous: string,
  next: string,
  limit: number,
): string {
  if (next.length <= limit || next.length <= previous.length) return next;

  // Locate what changed: the shared head, the shared tail, and what sits
  // between them is the edit.
  let head = 0;
  while (
    head < previous.length &&
    head < next.length &&
    previous[head] === next[head]
  ) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < previous.length - head &&
    tail < next.length - head &&
    previous[previous.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail += 1;
  }

  const removed = previous.length - head - tail;
  const room = limit - (previous.length - removed);
  if (room <= 0) return previous;

  let inserted = next.slice(head, next.length - tail).slice(0, room);
  // A cut that lands between the halves of a surrogate pair leaves a lone
  // half, which renders as a replacement character and is not valid text.
  const last = inserted.charCodeAt(inserted.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) inserted = inserted.slice(0, -1);

  return previous.slice(0, head) + inserted + next.slice(next.length - tail);
}
