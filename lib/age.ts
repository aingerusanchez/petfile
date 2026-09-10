import { parseISO } from "./dates";

/**
 * The dog's age, and the stage of life it puts him in.
 *
 * The profile's header presents the animal rather than asking about him, and
 * "2 años" says less than "2 años · Adulto": the stage is what changes what a
 * tutor should be doing — how often he eats, how much he should walk, when the
 * vet starts checking for other things. It is the first piece of advice the
 * app can give away for free, from data it already has.
 *
 * **The thresholds are the common veterinary split, not a breed-aware model.**
 * Six months ends puppyhood, eighteen ends adolescence, seven years begins
 * senior. Body size moves the last one hard — a Great Dane is senior at six
 * and a chihuahua at ten — and the app cannot know size yet: `breed_primary`
 * is free text with no weight band behind it, and a mixed dog may have no
 * breed at all. So this is deliberately one curve for every dog, and the place
 * to refine it is when breed carries a size, not by guessing here.
 */

export type LifeStage = "puppy" | "adolescent" | "adult" | "senior";

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  puppy: "Cachorro",
  adolescent: "Adolescente",
  adult: "Adulto",
  senior: "Senior",
};

/** Months lived, in calendar months. Null when there is no usable birth date. */
export function ageInMonths(
  birthDate: string | null,
  today: Date = new Date(),
): number | null {
  const parts = parseISO(birthDate);
  if (!parts) return null;

  let months =
    (today.getFullYear() - parts.year) * 12 +
    (today.getMonth() + 1 - parts.month);
  // The month only counts once its day has come round.
  if (today.getDate() < parts.day) months -= 1;

  // A birth date in the future is a validation problem, not an age. The form
  // already refuses one; presenting "-3 meses" would be inventing an answer.
  return months < 0 ? null : months;
}

export function lifeStage(months: number): LifeStage {
  if (months < 6) return "puppy";
  if (months < 18) return "adolescent";
  if (months < 84) return "adult";
  return "senior";
}

/**
 * The age as a tutor would say it out loud.
 *
 * Months up to two years, then whole years — which is how people talk about
 * dogs ("tiene 15 meses", "tiene 3 años") and also where the precision stops
 * being interesting. Years truncate rather than round, because a dog is two
 * until his third birthday.
 *
 * An **approximate** birth date knows the month and the year but not the day,
 * so the age is right to within a month. That is worth saying rather than
 * hiding behind a number that looks exact: the phrase softens to "unos 2
 * años", the same honesty `formatDisplayDate` applies to the date itself.
 */
export function formatAge(months: number, approximate = false): string {
  if (months < 1) return "Menos de un mes";

  const phrase =
    months < 24
      ? `${months} ${months === 1 ? "mes" : "meses"}`
      : `${Math.floor(months / 12)} años`;

  if (!approximate) return phrase;
  return months === 1 ? "un mes" : `unos ${phrase}`;
}

export type PetAge = {
  months: number;
  stage: LifeStage;
  stageLabel: string;
  /** The age on its own, already in the app's voice. */
  text: string;
};

/** Everything the header needs about the age, or null when it cannot be known. */
export function describeAge(
  birthDate: string | null,
  approximate = false,
  today: Date = new Date(),
): PetAge | null {
  const months = ageInMonths(birthDate, today);
  if (months === null) return null;

  const stage = lifeStage(months);
  return {
    months,
    stage,
    stageLabel: LIFE_STAGE_LABELS[stage],
    text: formatAge(months, approximate),
  };
}
