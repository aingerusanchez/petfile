/**
 * Durations as a person says them, and back.
 *
 * "90 min" is a number the reader has to divide; "1h 30m" is a length they can
 * feel. Once a walk goes past an hour the raw minutes stop being the friendly
 * form, so everything that *shows* a duration shows it this way, and the two
 * fields that *take* one accept either.
 *
 * **Bare digits are minutes**, which is what the fields meant before this
 * existed — "90" has to keep working, or the change costs the tutor the habit
 * they already have. Hours only appear when the text says so.
 */

/**
 * A duration for reading: "45 min", "1h", "1h 30m", "5h".
 *
 * The unit word stays on the under-an-hour case because that is how the rest
 * of the app speaks ("40 min en 2 paseos"), and it is the only shape where the
 * number alone would be ambiguous — "1h 30m" needs no help.
 *
 * **`"minutes"` keeps everything in minutes**, for a tutor who thinks in them:
 * "90 min" rather than "1h 30m". It is a per-device preference (see
 * `lib/settings.tsx`), so the format is a parameter here rather than a lookup
 * — this module stays pure and testable, and every call site says which
 * format it is speaking.
 */
export function formatDuration(
  minutes: number,
  format: "hours" | "minutes" = "hours",
): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const whole = Math.round(minutes);
  if (format === "minutes" || whole < 60) return `${whole} min`;

  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Reads what a tutor types into a duration field, in minutes.
 *
 * Accepts `90`, `90m`, `90min`, `1h`, `1h30`, `1h 30m` and `1:30`, in any
 * casing and with spaces wherever they land. Returns null for anything else,
 * **including an empty string** — the caller knows whether empty means
 * "cleared" or "not a duration", and those are different answers.
 *
 * Decimal hours ("1,5h") are deliberately out: the comma and the dot disagree
 * across locales, and "unos cuarenta minutos" is already "40" — bare minutes
 * cover the approximation.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return null;

  // 1:30 — unambiguous in a duration field, whatever it would mean on a clock.
  const clock = /^(\d+):(\d{1,2})$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const parts = /^(?:(\d+)h)?(?:(\d+)(?:min|m)?)?$/.exec(value);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) return null;

  const hours = Number(parts[1] ?? 0);
  const minutes = Number(parts[2] ?? 0);
  const total = hours * 60 + minutes;
  return Number.isFinite(total) ? total : null;
}

/** What to say when the text is not a duration. Kept with the parser. */
export const DURATION_HINT = "Escríbelo como 1h 30m";

/**
 * A day's walking: the minutes, and how many walks they came in.
 *
 * **One value with two halves, rather than two numbers travelling
 * separately.** The measure states both in one sentence, and the day is
 * either known or it is not — a count without minutes, or minutes with a
 * count from a different read, would put a number on screen that nothing
 * adds up to. Pairing them makes "as true as the minutes" structural instead
 * of a thing to remember: the one `null` upstream covers both.
 *
 * `walks` is how many walks those minutes came from, so a walk with no
 * length — one still running, one abandoned, one nobody timed — is in
 * neither half. See `walkCount` in `lib/events.ts`, which is where the two
 * are read off the same rows.
 */
export type Walked = { minutes: number; walks: number };

/**
 * The day's walking as the day screen says it: `1h 8m en 3 paseos`.
 *
 * **It states what was done and never what is missing**, which is why it
 * takes no goal. The measure used to end `de 4h` — the top tier, so that the
 * words could not disagree with a bar that runs to double — and the tutor
 * removed the ceiling: «no debería haber un límite máximo, no queremos hacer
 * que el usuario sea vago y conformista». The second reason needed no saying:
 * that `4h` was not their goal either. They had typed 2 h, and the sentence
 * stated a target nobody had set.
 *
 * **No walks names the dog instead of measuring him** — `Loki aún no ha
 * salido`. It read `0 min paseados` and the tutor took it out: first thing in
 * the morning that was the entire sentence the screen had to offer, and a
 * measure of nothing is not a measure. The earlier reasoning here said every
 * phrasing of a zero smuggles the expectation back in, and that still holds
 * for the phrasings aimed at the reader — `¿aún no has paseado?` makes the
 * day's first glance a reproach. **The subject is the dog, which is what
 * makes the difference**: it reports that the walking has not started, the
 * way the rest of the line reports what it was, and asks nobody for anything.
 *
 * **And it never says "hoy".** The block renders on past days too, so a day
 * named in the sentence would sit under a header already reading "Ayer" —
 * the header names the day, and one place saying it is enough.
 */
export function formatWalked(
  walked: Walked,
  petName: string,
  format: "hours" | "minutes" = "hours",
): string {
  // No walks and no minutes is the only state with nothing to measure, so it
  // is the only one that says a sentence instead. Minutes without a walk to
  // put them in cannot come off the rows — `walks` counts what `minutes`
  // sums — but it would be the one way to claim the dog stayed in over a
  // number saying he did not, so it keeps the number.
  if (walked.walks <= 0 && walked.minutes <= 0) {
    return `${petName} aún no ha salido`;
  }

  const minutes = formatDuration(walked.minutes, format);
  if (walked.walks <= 0) return `${minutes} paseados`;
  return `${minutes} en ${walked.walks} ${walked.walks === 1 ? "paseo" : "paseos"}`;
}
