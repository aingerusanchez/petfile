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
export function toApproximateISO(year: number, month: number): string {
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

/** The year range offered by the picker: this year back through `span` years. */
export function yearChoices(today: Date = new Date(), span = 30): number[] {
  const current = today.getFullYear();
  return Array.from({ length: span }, (_, i) => current - i);
}
