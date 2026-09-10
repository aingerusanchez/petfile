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
 * of the app speaks ("40 min paseados"), and it is the only shape where the
 * number alone would be ambiguous — "1h 30m" needs no help.
 */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "";
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;

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
 * across locales, and the field has -15 / +15 for the cases where a tutor is
 * approximating anyway.
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
