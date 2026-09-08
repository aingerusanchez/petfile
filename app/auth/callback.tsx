import * as Linking from "expo-linking";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Button, LoadingScreen, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";

/**
 * The OAuth redirect target, `petfile://auth/callback`.
 *
 * **Why this route has to exist.** The scheme is registered in the Android
 * manifest, so when the browser navigates to the redirect the OS also hands
 * the URL to the app as a deep link — on top of `openAuthSessionAsync`
 * resolving with it. Without a route here, Expo Router matched nothing and
 * showed its built-in "Unmatched Route" debug screen mid-sign-in, even though
 * the session had in fact been established.
 *
 * So this is normally a screen nobody sees for more than a frame: the session
 * is already set by the time it mounts and it redirects straight out. It
 * consumes the URL itself only as a fallback, for the case where the auth
 * session did not capture the redirect and this deep link is the *only*
 * delivery.
 */
export default function AuthCallback() {
  const { session, loading, completeSignIn } = useAuth();
  const router = useRouter();
  const url = Linking.useURL();
  const [failure, setFailure] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // Already signed in: openAuthSessionAsync got there first, which is the
    // normal path. Nothing to consume.
    if (session) {
      setSettled(true);
      return;
    }
    if (loading || !url) return;

    let cancelled = false;
    completeSignIn(url)
      .then(({ error }) => {
        if (cancelled) return;
        if (error) setFailure(error);
        setSettled(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFailure("No se pudo completar el inicio de sesión");
        setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, [session, loading, url, completeSignIn]);

  if (session) return <Redirect href="/" />;

  if (failure) {
    return (
      <Screen center>
        <Text
          accessibilityLiveRegion="polite"
          className="mb-5 text-center text-error"
        >
          {failure}
        </Text>
        {/* Back to the login screen rather than a retry here: whatever went
            wrong happened in the browser, and the only way to try again is to
            start the flow over. */}
        <Button
          testID="callback-retry"
          label="Volver a intentarlo"
          onPress={() => router.replace("/login")}
        />
      </Screen>
    );
  }

  // Settled with no session and no error means the deep link carried nothing
  // useful — a stale link, or one opened by hand. Send them to the start.
  if (settled) return <Redirect href="/" />;

  return <LoadingScreen label="Completando el inicio de sesión" />;
}
