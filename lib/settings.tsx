import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * How this tutor wants the app to read, kept on their own device.
 *
 * **Per device, not per account, and that is the design.** The household has
 * two tutors with a phone each; a display preference belongs to the person
 * holding the phone, not to the dog's record. It also means no migration, no
 * RLS policy and no round trip — the app reads it before the first frame it
 * would matter for.
 *
 * **Nothing here changes what is stored.** Times are still instants and
 * durations are still minutes; these settings decide how they are written
 * down. The moment a setting would change the *data* it belongs in `pets` or a
 * new table, not here.
 */

export type TimeFormat = "24h" | "12h";
export type DurationFormat = "hours" | "minutes";

export type Settings = {
  timeFormat: TimeFormat;
  durationFormat: DurationFormat;
};

export const DEFAULT_SETTINGS: Settings = {
  // Spanish writes 24-hour time, and it is also the only form the number pad
  // can express without a meridiem control.
  timeFormat: "24h",
  durationFormat: "hours",
};

const STORAGE_KEY = "petfile.settings.v1";

/** Reads a stored blob without trusting it: an unknown value falls back. */
export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<Settings>;
    return {
      timeFormat: value.timeFormat === "12h" ? "12h" : "24h",
      durationFormat: value.durationFormat === "minutes" ? "minutes" : "hours",
    };
  } catch {
    // A corrupt blob is not worth an error message: the defaults are correct
    // for everyone who never opened Ajustes.
    return DEFAULT_SETTINGS;
  }
}

type SettingsContext = {
  settings: Settings;
  /** True until the stored value has been read, so nothing renders it twice. */
  loading: boolean;
  update: (patch: Partial<Settings>) => void;
};

const Context = createContext<SettingsContext>({
  settings: DEFAULT_SETTINGS,
  loading: false,
  update: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        setSettings(parseSettings(raw));
        setLoading(false);
      })
      .catch(() => {
        // Storage that cannot be read is the defaults, silently: a preference
        // is not worth interrupting a tutor over.
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      // Optimistic on purpose: the switch has already moved under the thumb,
      // and a failed write costs a preference rather than data.
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(
        () => {},
      );
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, loading, update }),
    [settings, loading, update],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSettings(): SettingsContext {
  return useContext(Context);
}
