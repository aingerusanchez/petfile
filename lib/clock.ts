/**
 * Where a value sits on a clock face, and which value a finger landed on.
 *
 * **Trigonometry in `lib/`, for the reason the crop maths is here too.** A
 * wrong angle does not throw — it points the hand at 3 when the tutor chose 9,
 * or picks the hour on the other side of the day, and nothing anywhere says so.
 * The component draws and handles touches; every number it uses comes from
 * here, and every one of them is tested.
 */

/** Twelve marks on the face, whatever is being set on it. */
export const DIAL_MARKS = 12;

/**
 * Degrees clockwise from twelve o'clock.
 *
 * Twelve o'clock is the zero of a clock face, not three o'clock — which is
 * where `Math.atan2`'s zero is, and the reason every conversion here goes
 * through this one function rather than through the standard library's idea of
 * an angle.
 */
export function markAngle(step: number, steps: number): number {
  return ((step % steps) / steps) * 360;
}

/**
 * The offset of a mark from the centre of the face, in the screen's axes.
 *
 * Y grows **downward**, as it does in every layout this is fed into, so twelve
 * o'clock is negative y. Handing back screen offsets rather than an angle keeps
 * the sign convention in one place instead of at every call site.
 */
export function markPoint(
  step: number,
  steps: number,
  radius: number,
): { x: number; y: number } {
  const radians = (markAngle(step, steps) * Math.PI) / 180;
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

/**
 * The nearest mark to a point, or `null` when there is no answer.
 *
 * **The centre has no angle**, and `atan2(0, 0)` returns 0 rather than saying
 * so — a drag that crosses the middle of the dial would snap to twelve o'clock
 * on the way past. Inside the dead zone the hand holds where it was, which is
 * both what the finger meant and what every native picker does.
 */
export function markFromPoint(
  dx: number,
  dy: number,
  steps: number,
  deadZone = 12,
): number | null {
  if (Math.hypot(dx, dy) < deadZone) return null;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const clockwise = (degrees + 360) % 360;
  return Math.round((clockwise / 360) * steps) % steps;
}

export type Clock = { hour: number; minute: number };

/**
 * A time out of whatever the field currently holds.
 *
 * The same shapes the field itself accepts — "9:15", "09.15", "915" — because
 * this reads a half-typed field rather than a stored value, and returns `null`
 * for anything that is not yet a time. A field mid-typing is not an error; it
 * is the picker's cue to open on the clock instead.
 */
export function parseClock(text: string): Clock | null {
  const match = /^\s*(\d{1,2})[:.]?(\d{2})\s*$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The one form that crosses back into the field: 24-hour, zero-padded. */
export function formatClock({ hour, minute }: Clock): string {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Two digits, for a face label and for half of the header. */
export function clockDigits(value: number): string {
  return pad(value);
}

/**
 * Which twelve hours the face is showing.
 *
 * **A day has twenty-four hours and a clock face has twelve marks**, and the
 * usual way out — a second ring inside the first — puts its numbers 38dp apart
 * on this phone, well under the 48dp floor this project measured and enforces.
 * So the face carries one ring and a switch says which half of the day it is
 * labelled with. The hand does not move when the half changes: 09 and 21 are
 * the same place on a clock, which is the whole reason the trick works.
 */
export type DayHalf = "morning" | "afternoon";

export function halfOf(hour: number): DayHalf {
  return hour < 12 ? "morning" : "afternoon";
}

/** The hour at a mark, on the half currently shown. */
export function hourAt(mark: number, half: DayHalf): number {
  return half === "morning" ? mark : mark + 12;
}

/** The mark an hour sits on, whichever half it belongs to. */
export function markOfHour(hour: number): number {
  return hour % 12;
}
