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

type ActivePetContext = {
  /** The id last chosen on this device, or null if none is known yet. */
  activePetId: string | null;
  setActivePetId: (id: string) => void;
};

const Context = createContext<ActivePetContext>({
  activePetId: null,
  setActivePetId: () => {},
});

export function ActivePetProvider({ children }: { children: ReactNode }) {
  const [activePetId, setId] = useState<string | null>(null);
  // A pick made before the stored value has been read must not be overwritten
  // when the read lands a moment later.
  const chosen = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ACTIVE_PET_STORAGE_KEY)
      .then((raw) => {
        if (cancelled || chosen.current) return;
        setId(parseActivePetId(raw));
      })
      .catch(() => {
        // Storage that cannot be read is no choice on record, silently.
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
    () => ({ activePetId, setActivePetId }),
    [activePetId, setActivePetId],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useActivePet(): ActivePetContext {
  return useContext(Context);
}
