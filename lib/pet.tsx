import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { withTimeout } from "./failures";

/**
 * Which of the household's pets this phone is looking at, kept on the phone.
 *
 * **Per device, for the same reason the display formats are.** Two tutors share
 * the dogs but each carries their own phone, and one may be walking Luna while
 * the other fills in Toby's diary on the sofa. Whom a person is attending to
 * right now is a fact about the person holding the device, not about the
 * animal, so a choice written to a row would make one tutor's tap move the
 * other's screen. Nothing is stored server-side, and so nothing to migrate.
 *
 * **What is kept is the id as it was chosen, not the pet it points at.** The
 * pet may have been deleted since, or the list may not have arrived yet, and
 * this provider knows nothing about either: it never asks the database.
 * `pickActivePet` in `lib/pets.ts` decides who is active, and each screen
 * calls it with the list it already holds.
 *
 * **`null` means two things, and `loading` is what tells them apart.**
 * - `loading` true: the disk has not been read yet. `null` here says nothing
 *   about the tutor, so a screen must not fall back to the first pet or
 *   conclude that nobody chose — it waits. A non-null id is already a real
 *   choice (made this session, before the read landed) and can be trusted.
 * - `loading` false and `null`: the read is over and there is no choice on
 *   record — a tutor who never picked, a blob that could not be understood, or
 *   storage that could not be read. This is when falling back to the first pet
 *   is right.
 */

/** Versioned like the settings key, so a future shape can leave this one alone. */
export const ACTIVE_PET_STORAGE_KEY = "petfile.pet.v1";

/** Reads a stored blob without trusting it: anything unintelligible is no pet. */
export function parseActivePetId(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { id?: unknown } | null;
    return typeof value?.id === "string" && value.id !== "" ? value.id : null;
  } catch {
    // A corrupt blob is not worth an error message: with no choice on record
    // the screens fall back to the first pet, which is right for everyone who
    // never picked one.
    return null;
  }
}

/** The one shape `parseActivePetId` reads, so the pair cannot drift apart. */
export function serializeActivePetId(id: string): string {
  return JSON.stringify({ id });
}

/**
 * How long the disk may take before the app stops waiting for it.
 *
 * **Five seconds and not the network's twelve, because this is a local
 * read and the price of waiting is the whole app.** Every screen that shows
 * a pet holds a `LoadingScreen` until this flag comes down, so an
 * `AsyncStorage.getItem` that never settles is not a slow preference — it
 * is a hang with no error and no way out but killing the app.
 * `lib/settings.tsx` has the same unbounded read and it is genuinely
 * harmless there: unanswered settings leave the formats at their defaults
 * and the app works.
 *
 * **It is short because firing early is cheap.** A read cut off here
 * resolves to "no choice on record", which is the same answer a phone that
 * has never picked gives, so the worst case is the oldest sheet instead of
 * the chosen one for one launch — the stored value is never written over,
 * so the next launch has it back. Twelve seconds of spinner to avoid that
 * is the wrong trade; twelve is a ceiling on a radio in a vet's waiting
 * room, and this is SQLite on the same device.
 */
export const ACTIVE_PET_READ_TIMEOUT_MS = 5_000;

/**
 * What the first read resolves to: whether to set an id at all, and which.
 *
 * Pure, and separate from the provider, because the three ways this can go
 * converge on one line and none of them was reachable from a test. **A read
 * that failed and a read that never came back are the same answer** — no
 * choice on record — and `resolveInitial(null, …)` is where they meet, so
 * the `catch` has nothing of its own to get wrong.
 *
 * `chosen` is the other half: a pick made in this session before the disk
 * answered is a real choice by a tutor who is already looking at that dog,
 * and the stale value landing a moment later must not pull the screen back.
 */
export function resolveInitial(
  raw: string | null,
  chosen: boolean,
): { apply: boolean; id: string | null } {
  if (chosen) return { apply: false, id: null };
  return { apply: true, id: parseActivePetId(raw) };
}

type ActivePetContext = {
  /** The id last chosen on this device. Null is ambiguous while `loading`. */
  activePetId: string | null;
  /** True until the stored value has been read, so `null` is not yet an answer. */
  loading: boolean;
  setActivePetId: (id: string) => void;
};

const Context = createContext<ActivePetContext>({
  activePetId: null,
  loading: false,
  setActivePetId: () => {},
});

export function ActivePetProvider({ children }: { children: ReactNode }) {
  const [activePetId, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // A pick made before the stored value has been read must not be overwritten
  // when the read lands a moment later.
  const chosen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // **Bounded, like every request in the app and for a worse reason.** A
    // network call that hangs costs one screen's content; this one costs the
    // app, because five screens wait on the flag below. See
    // `ACTIVE_PET_READ_TIMEOUT_MS`. The `catch` folds the timeout and an
    // unreadable store into the same `null`: both are "no choice on record",
    // said silently, and `resolveInitial` is where they meet.
    withTimeout(
      AsyncStorage.getItem(ACTIVE_PET_STORAGE_KEY),
      "activePet",
      ACTIVE_PET_READ_TIMEOUT_MS,
    )
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;
        const initial = resolveInitial(raw, chosen.current);
        if (initial.apply) setId(initial.id);
        // The flag comes down on every path, including the two failures —
        // leaving it up is the hang this timeout exists to prevent, arriving
        // by the other door.
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setActivePetId = useCallback((id: string) => {
    chosen.current = true;
    setId(id);
    // Optimistic on purpose: the screen has already switched, and a failed
    // write costs a choice rather than data.
    void AsyncStorage.setItem(
      ACTIVE_PET_STORAGE_KEY,
      serializeActivePetId(id),
    ).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ activePetId, loading, setActivePetId }),
    [activePetId, loading, setActivePetId],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useActivePet(): ActivePetContext {
  return useContext(Context);
}
