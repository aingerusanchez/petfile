/**
 * What a walk's stools were like, on a five-point scale.
 *
 * **The healthy value is the middle one, not an end.** The scale a tutor
 * reaches for first runs "perfect → diarrhoea", which makes the worst thing
 * always the most liquid — and switching a dog to natural food *hardens*:
 * more bone, more calcium, and a dry stool that costs the animal effort is a
 * sign of dehydration or too much mineral. On a one-ended scale that gets
 * recorded as "perfect", which is the opposite of what happened. Anchored in
 * the middle, the distance from the centre is the measure, in both
 * directions — the shape the veterinary faecal charts use.
 *
 * **Mucus and blood are not on it, and not here at all.** Mucus appears at any
 * consistency, and alongside blood it is a vet visit rather than an
 * intermediate step — so it was never a rung. It was briefly two flags on the
 * walk, and that was wrong too: a walk is logged in a hurry, and two more
 * things to consider is friction on the path everybody takes for the sake of
 * the one they almost never do. Something worth a vet's attention is an
 * incident today, and the health tab when it exists.
 */
export const STOOL_SCALE = [
  { value: 1, label: "Dura", spoken: "Dura y seca" },
  { value: 2, label: "Perfecta", spoken: "Perfecta, firme y se recoge limpia" },
  { value: 3, label: "Blanda", spoken: "Blanda pero con forma" },
  { value: 4, label: "Sin forma", spoken: "Sin forma, difícil de recoger" },
  { value: 5, label: "Diarrea", spoken: "Diarrea, líquida" },
] as const;

export type StoolValue = (typeof STOOL_SCALE)[number]["value"];

/** The healthy anchor, for anything that has to say what "good" looks like. */
export const STOOL_IDEAL: StoolValue = 2;

/**
 * What one walk recorded, in the order it was tapped — most walks record
 * nothing, and the list is the whole of it.
 */
export type Stools = StoolValue[];

export const NO_STOOLS: Stools = [];

/** How many of these one walk can hold. A number, so the UI cannot run away. */
export const MAX_STOOLS = 6;

function isStoolValue(value: unknown): value is StoolValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

/**
 * Reads what a walk stored, from a `details` blob nobody validates.
 *
 * `details` is `jsonb` written by this app and by nothing else, but it is
 * still the one place a row can carry a shape the code did not expect — an
 * older build, a hand-edited row. Anything that is not a value on the scale is
 * dropped rather than rendered, because a stool of `"mucho"` has no place on
 * a five-point chart.
 */
export function readStools(details: unknown): Stools {
  const blob = (details ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(blob.stools) ? blob.stools : [];
  return raw.filter(isStoolValue).slice(0, MAX_STOOLS);
}

/**
 * The `details` keys a walk writes, or none when there is nothing to say.
 *
 * **Absent rather than empty.** A walk with no stools writes no key at all, so
 * "we did not look" and "there was nothing" stay the same fact — which is the
 * honest one, since nobody is asked.
 */
export function writeStools(stools: Stools): { stools?: StoolValue[] } {
  if (stools.length === 0) return {};
  return { stools: stools.slice(0, MAX_STOOLS) };
}

/** The scale's own word for a value, for anything that has to say it aloud. */
export function stoolLabel(value: StoolValue): string {
  return (
    STOOL_SCALE.find((step) => step.value === value)?.label ?? String(value)
  );
}

export function stoolSpoken(value: StoolValue): string {
  return (
    STOOL_SCALE.find((step) => step.value === value)?.spoken ?? String(value)
  );
}

/**
 * What a set of stools says out loud, for the walk's own accessible name.
 *
 * Reads as somebody would: "dos kakas: perfecta, blanda". The count leads,
 * because it is what a glance at the row gives.
 */
export function describeStools(stools: Stools): string | null {
  if (stools.length === 0) return null;
  const listed = stools.map(stoolLabel).join(", ").toLowerCase();
  return stools.length === 1
    ? `una kaka: ${listed}`
    : `${stools.length} kakas: ${listed}`;
}
