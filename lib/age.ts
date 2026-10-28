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
 * **The first birthday is where the unit changes**, and this function used to
 * get that wrong. It said months all the way to two years, on the written
 * reasoning that "es como se habla de los perros" — which is true of a dog of
 * eight months and false of one that blew out a candle yesterday. Nobody says
 * "trece meses" the day after the tarta. Measured against the only dog this
 * app has: Loki turned one and the header kept counting in months.
 *
 * So: months below the year, `1 año` on the day itself, and `1 año y N meses`
 * until the second birthday, which keeps the precision that made months worth
 * using in the first place. From two years on, whole years. Years truncate
 * rather than round, because a dog is two until his third birthday.
 *
 * An **approximate** birth date knows the month and the year but not the day,
 * so the age is right to within a month — which is exactly the precision
 * `1 año y 1 mes` claims to have. Past the first birthday the approximate
 * phrasing therefore drops the months rather than inventing them, the same
 * honesty `formatDisplayDate` applies to the date itself.
 */
export function formatAge(months: number, approximate = false): string {
  if (months < 1) return "Menos de un mes";

  // Two softeners rather than one, because Spanish has no "unos" that agrees
  // with a singular year: "unos 1 año" is not a sentence anybody would say.
  if (approximate) {
    if (months === 1) return "un mes";
    if (months < 12) return `unos ${months} meses`;
    if (months < 24) return "alrededor de un año";
    return `unos ${Math.floor(months / 12)} años`;
  }

  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  if (months === 12) return "1 año";
  if (months < 24) {
    const rest = months - 12;
    return `1 año y ${rest} ${rest === 1 ? "mes" : "meses"}`;
  }
  return `${Math.floor(months / 12)} años`;
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
