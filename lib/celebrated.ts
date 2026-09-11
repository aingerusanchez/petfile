import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "petfile.celebrated.v1";

/**
 * Milestones this device has already celebrated.
 *
 * **It lives on the device, not in the row**, for the same reason the display
 * preferences do: the household is two tutors with a phone each, and a
 * celebration is for the person holding the phone. If one tutor opens the app
 * on the animal's birthday and the other opens it an hour later, they should
 * both get the confetti — a flag in Postgres would give it to whoever was
 * first and silently rob the second.
 *
 * The cost is that reinstalling loses the record, so a birthday already
 * celebrated can fire once more. That is the right way round: a celebration
 * repeated is a shrug, a celebration missed is the thing the feature exists
 * to prevent.
 *
 * Ids are opaque strings, `birthday:<petId>:<year>` today. The set is one
 * entry per pet per year, so it needs no pruning in any lifetime this app
 * will see.
 */
async function read(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    // Unreadable storage is the same answer as empty storage: celebrate. The
    // alternative is swallowing the one moment this file exists for.
    return [];
  }
}

/** Whether `id` has been celebrated on this device. */
export async function wasCelebrated(id: string): Promise<boolean> {
  return (await read()).includes(id);
}

/** Records `id` as celebrated. Writing is best-effort by design. */
export async function markCelebrated(id: string): Promise<void> {
  try {
    const ids = await read();
    if (ids.includes(id)) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]));
  } catch {
    // A failed write means the confetti may come back next time the app
    // opens. Nothing else depends on this, so there is nothing to report.
  }
}

/** The id for an animal's birthday in a given year. */
export function birthdayMilestone(petId: string, year: number): string {
  return `birthday:${petId}:${year}`;
}
