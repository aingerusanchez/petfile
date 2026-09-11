import Constants from "expo-constants";
import { useRef } from "react";
import { Pressable } from "react-native";
import { Text } from "./Text";

/** Taps to reveal, and how long a run of them stays a run. */
const TAPS = 5;
const RUN_MS = 1500;

/** What the running build calls itself, or null when the config is missing. */
export const APP_VERSION: string | null = Constants.expoConfig?.version ?? null;

/**
 * The commit the build came from, with a `+` when the tree was dirty.
 *
 * Null where `app.config.js` could not reach git — EAS, a tarball, CI.
 */
export const APP_COMMIT: string | null =
  (Constants.expoConfig?.extra?.commit as string | undefined) ?? null;

/**
 * The build's version, at the foot of a screen.
 *
 * **It is here to tell two builds apart.** A stale APK cost an afternoon of
 * chasing a bug that had already been fixed — the phone and the repo disagreed
 * and nothing on screen said so. It sits on the login screen, which is the one
 * surface a tutor sees before signing in, and at the foot of Ajustes, which is
 * where anyone goes looking for it.
 *
 * **The commit is the half that works without discipline.** The version only
 * separates two builds if somebody remembered to bump it, and twice now one
 * did not: the phone was behind and the number on it agreed with the repo. A
 * commit hash separates them for free, and a trailing `+` says the tree was
 * dirty when the build ran.
 *
 * **It names the native build, not the JS bundle.** `expo-constants` reads the
 * `app.config` embedded in the APK, so a dev build reports whatever version it
 * was compiled at even while Metro serves newer JavaScript. That is the right
 * behaviour for the problem it exists for — a stale *install* — and a real
 * limitation for the other one: it cannot tell you the bundle is old.
 *
 * `text-muted` on Polar Night measures 3.19:1, below AA — deliberately: this
 * is not content, it is a serial number, and it should be findable without
 * competing with anything. It carries a real accessible name so a screen
 * reader announces "versión 1.1.0" rather than spelling out "v1.1.0".
 *
 * **Five taps open the changelog, where a screen offers it.** Android's own
 * gesture, and it keeps the line looking like what it is — the alternative
 * was a labelled "Novedades" row in Ajustes, which spends a permanent piece
 * of a settings screen on something read twice a year. Only the settings
 * screen passes `onReveal`; on the login screen this stays inert text, since
 * nobody signed out is asking what changed.
 *
 * A screen reader reaches it the same way: TalkBack's double-tap fires
 * `onPress`, so the five presses count identically. Nothing announces the
 * gesture, which is what makes it an easter egg rather than a feature — the
 * changelog itself is in the repo for anyone who wants it plainly.
 */
export function Version({
  testID,
  onReveal,
}: {
  testID?: string;
  /** Called on the fifth tap in quick succession. Omit for a plain label. */
  onReveal?: () => void;
}) {
  // A ref, not state: nothing on screen changes until the fifth tap, and the
  // count is written in a handler rather than during render.
  const run = useRef({ taps: 0, at: 0 });

  if (!APP_VERSION) return null;

  const label = APP_COMMIT
    ? `Versión ${APP_VERSION}, commit ${APP_COMMIT}`
    : `Versión ${APP_VERSION}`;
  const shown = APP_COMMIT
    ? `v${APP_VERSION} · ${APP_COMMIT}`
    : `v${APP_VERSION}`;

  if (!onReveal) {
    return (
      <Text
        testID={testID}
        accessibilityLabel={label}
        className="text-center text-xs text-text-muted"
      >
        {shown}
      </Text>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        const now = Date.now();
        // A run that went cold starts again, so five taps spread over a week
        // are not five taps.
        const taps = now - run.current.at > RUN_MS ? 1 : run.current.taps + 1;
        run.current = { taps, at: now };
        if (taps < TAPS) return;
        run.current = { taps: 0, at: 0 };
        onReveal();
      }}
      className="items-center py-2 active:opacity-70"
    >
      <Text className="text-center text-xs text-text-muted">{shown}</Text>
    </Pressable>
  );
}
