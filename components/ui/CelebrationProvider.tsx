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
  /** Fire the one-shot celebration. A second call while one runs is ignored. */
  celebrate: () => void;
};

const CelebrationContext = createContext<CelebrationApi | null>(null);

/**
 * Hosts the celebration above the navigator, for the same reason the toast
 * host lives there: the screen that earns a celebration is usually the screen
 * that navigates away, and an effect rendered by it would be unmounted before
 * it landed.
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);

  const celebrate = useCallback(() => setRunning(true), []);
  const api = useMemo<CelebrationApi>(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={api}>
      {children}
      {running ? <Celebration onDone={() => setRunning(false)} /> : null}
    </CelebrationContext.Provider>
  );
}

export function useCelebration(): CelebrationApi {
  const api = useContext(CelebrationContext);
  if (!api)
    throw new Error("useCelebration must be used inside CelebrationProvider");
  return api;
}
