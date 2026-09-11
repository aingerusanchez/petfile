/**
 * Date conversion at the app/database boundary.
 *
 * The `pets.birth_date` column is a Postgres `date` and the create RPC casts
 * with `(pet ->> 'birth_date')::date`, where Postgres's default DateStyle is
 * ISO/MDY. A Spanish-locale string like `14/09/2025` is ambiguous there at
 * best and misparsed at worst, so **ISO `YYYY-MM-DD` is the only format that
 * crosses the wire**. These functions convert at the edge; nothing else in the
 * app should build or read a date string by hand.
 *
 * The display format is the Spanish locale's `DD/MM/AAAA`. A per-user format
 * setting is a future version — see PRODUCT.md.
 */

export const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export const MONTHS_ES_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateParts = { year: number; month: number; day: number };

/** Days in a given month, honouring leap years. `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Splits an ISO `YYYY-MM-DD` string. Returns null for anything malformed. */
export function parseISO(iso: string | null): DateParts | null {
  if (!iso) return null;
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Builds the ISO string the database expects. Clamps the day into the month. */
export function toISO({ year, month, day }: DateParts): string {
  const safeDay = Math.min(Math.max(day, 1), daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/**
 * The ISO string for an approximate birth date: the day is not data, so it is
 * pinned to the first of the month. Anything reading this value back must
 * check `birth_date_approximate` before treating the day as real.
 */
export function toApproximateISO({
  year,
  month,
}: Omit<DateParts, "day">): string {
  return toISO({ year, month, day: 1 });
}

/**
 * Renders a stored ISO date for a Spanish reader.
 *
 * An approximate date shows only what is actually known — "septiembre de 2025"
 * rather than "01/09/2025", which would present a placeholder day as fact.
 */
export function formatDisplayDate(
  iso: string | null,
  approximate = false,
): string {
  const parts = parseISO(iso);
  if (!parts) return "";
  if (approximate) return `${MONTHS_ES[parts.month - 1]} de ${parts.year}`;
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

const WEEKDAYS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

/** Whole days from `day` back to `reference`, both taken at local midnight. */
export function daysAgo(day: Date, reference: Date): number {
  const a = new Date(day);
  a.setHours(0, 0, 0, 0);
  const b = new Date(reference);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * What to call a day: "Hoy", "Ayer", or its weekday.
 *
 * The headline names the day the way a person would. Two days back nobody
 * says "anteayer" out loud any more, and the weekday is what they reach for
 * instead — so from there it is "Martes", with the date on the line below.
 */
export function formatDayHeadline(day: Date, today: Date): string {
  const ago = daysAgo(day, today);
  if (ago === 0) return "Hoy";
  if (ago === 1) return "Ayer";
  const weekday = WEEKDAYS_ES[day.getDay()];
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/**
 * The years the animal turns on `day`, or null when that day is not it.
 *
 * **An approximate birth date needs no special case here, and that is the
 * point.** It is stored as the 1st of the month with
 * `birth_date_approximate = true`, so this matches the 1st every year — which
 * is a convention the tutor opted into when they said the date was
 * approximate, not a date the app invented. Nothing is *computed* from it,
 * which is the line AGENTS.md draws: a due date may not be built on a
 * placeholder day, and a greeting may.
 *
 * Returns 0 on the day the animal was born, which is a real day to mark and
 * not a birthday — the caller says so in words.
 */
export function birthdayOn(day: Date, birthDate: string | null): number | null {
  const parts = parseISO(birthDate);
  if (!parts) return null;
  if (day.getMonth() + 1 !== parts.month || day.getDate() !== parts.day) {
    return null;
  }
  const years = day.getFullYear() - parts.year;
  return years < 0 ? null : years;
}

/**
 * Whole days from `day` to the animal's next birthday, or null without one.
 *
 * **It finds a date that round-trips, rather than trusting the constructor.**
 * `new Date(2027, 1, 29)` is the 1st of March, so a dog born on a leap day
 * would otherwise be told its birthday is a day the calendar does not mark —
 * `birthdayOn` compares month and day exactly and would return null on that
 * same date. Skipping to the next year that really has a 29th of February
 * keeps the two agreeing: such a dog has a birthday every four years, which
 * is the joke and not a bug.
 *
 * Returns 0 on the day itself. An approximate birth date counts to the 1st of
 * its month, the same convention `birthdayOn` follows.
 */
export function daysUntilBirthday(
  day: Date,
  birthDate: string | null,
): number | null {
  const parts = parseISO(birthDate);
  if (!parts) return null;

  const from = new Date(day);
  from.setHours(0, 0, 0, 0);

  // Eight tries covers this year, next year, and any run of non-leap years a
  // 29th of February can hide behind.
  for (let i = 0; i <= 8; i++) {
    const candidate = new Date(
      from.getFullYear() + i,
      parts.month - 1,
      parts.day,
    );
    const rolled =
      candidate.getMonth() + 1 !== parts.month ||
      candidate.getDate() !== parts.day;
    if (rolled || candidate.getTime() < from.getTime()) continue;
    return Math.round((candidate.getTime() - from.getTime()) / 86_400_000);
  }
  return null;
}

/** "10 de septiembre" — the date under the headline, without the weekday. */
export function formatDayDate(day: Date): string {
  return `${day.getDate()} de ${MONTHS_ES[day.getMonth()].toLowerCase()}`;
}

/** The year range offered by the picker: this year back through `span` years. */
export function yearChoices(today: Date = new Date(), span = 30): number[] {
  const current = today.getFullYear();
  return Array.from({ length: span }, (_, i) => current - i);
}
