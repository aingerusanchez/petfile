import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Celebration } from "./Celebration";

type CelebrationApi = {
  /**
   * Fire the one-shot celebration. A second call while one runs is ignored.
   *
   * `tone` paints every piece in one colour, for a moment that has a colour
   * of its own: the goal bar's top tier is Aurora Boreal on the bar and in
   * the calendar, and The Shared Mark Rule says a mark wears its record's
   * colour wherever it appears. Omitted, the default palette falls.
   */
  celebrate: (tone?: string) => void;
};

const CelebrationContext = createContext<CelebrationApi | null>(null);

/**
 * Hosts the celebration above the navigator, for the same reason the toast
 * host lives there: the screen that earns a celebration is usually the screen
 * that navigates away, and an effect rendered by it would be unmounted before
 * it landed.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  // The tone the fall is wearing, or null when none is running: one piece of
  // state rather than two, so a colour can never outlive the confetti it
  // belongs to.
  const [running, setRunning] = useState<{ tone: string | null } | null>(null);

  // **The updater form is what keeps "a second call is ignored" true.** With
  // a boolean, a repeat call set the same value and React bailed out of the
  // render; an object is a new value every time, which would re-run the
  // fall's own done-timer and stretch it. Keeping the first one is also the
  // honest answer for the tone: the colour belongs to the moment that
  // started.
  const celebrate = useCallback(
    (tone?: string) =>
      setRunning((current) => current ?? { tone: tone ?? null }),
    [],
  );
  const api = useMemo<CelebrationApi>(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={api}>
      {children}
      {running !== null ? (
        <Celebration tone={running.tone} onDone={() => setRunning(null)} />
      ) : null}
    </CelebrationContext.Provider>
  );
}

export function useCelebration(): CelebrationApi {
  const api = useContext(CelebrationContext);
  if (!api)
    throw new Error("useCelebration must be used inside CelebrationProvider");
  return api;
}
