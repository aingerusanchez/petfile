import Constants from "expo-constants";
import { Text } from "./Text";

/** What the running build calls itself, or null when the config is missing. */
export const APP_VERSION: string | null = Constants.expoConfig?.version ?? null;

/**
 * The build's version, at the foot of a screen.
 *
 * **It is here to tell two builds apart.** A stale APK cost an afternoon of
 * chasing a bug that had already been fixed — the phone and the repo disagreed
 * and nothing on screen said so. It sits on the login screen, which is the one
 * surface a tutor sees before signing in, and at the foot of Ajustes, which is
 * where anyone goes looking for it.
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
 */
export function Version({ testID }: { testID?: string }) {
  if (!APP_VERSION) return null;

  return (
    <Text
      testID={testID}
      accessibilityLabel={`Versión ${APP_VERSION}`}
      className="text-center text-xs text-text-muted"
    >
      {`v${APP_VERSION}`}
    </Text>
  );
}
