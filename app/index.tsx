import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Button, LoadingScreen, Screen, Text } from "../components/ui";
import { useAuth } from "../lib/auth";
import { getMyPet } from "../lib/pets";

export default function Index() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const [attempt, setAttempt] = useState(0);

  /**
   * The pet check, tagged with the account it was made for.
   *
   * **Tagged rather than reset in an effect.** The `!session` branch used to
   * clear both values synchronously inside the effect, which is a cascading
   * render — and it was also not quite right: signing out and back in as
   * someone else left the previous answer on screen until the new request
   * resolved, long enough to redirect a tutor with no pet straight into the
   * tabs. Deriving from the tag makes a stale answer unreadable rather than
   * something that has to be raced.
   */
  const [check, setCheck] = useState<{
    for: string | null;
    hasPet: boolean | null;
    error: string | null;
  }>({ for: null, hasPet: null, error: null });

  const fresh = check.for === userId;
  const hasPet = fresh ? check.hasPet : null;
  const petCheckError = fresh ? check.error : null;

  const retry = useCallback(() => {
    setCheck({ for: null, hasPet: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    getMyPet()
      .then(({ pet, error }) => {
        if (cancelled) return;
        setCheck({
          for: userId,
          hasPet: error ? null : pet !== null,
          error: error ?? null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCheck({
          for: userId,
          hasPet: null,
          error:
            err instanceof Error
              ? err.message
              : "No hemos podido encontrar a tu perro",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  // A failed pet check must not be treated as "no pet" (that would risk a
  // duplicate pet being created) or leave the spinner spinning forever.
  if (petCheckError) {
    return (
      <Screen center>
        <Text
          accessibilityLiveRegion="polite"
          className="mb-5 text-center text-error"
        >
          {petCheckError}
        </Text>
        <Button testID="index-retry" label="Reintentar" onPress={retry} />
      </Screen>
    );
  }

  if (loading || (session && hasPet === null)) return <LoadingScreen />;

  if (!session) return <Redirect href="/login" />;
  return <Redirect href={hasPet ? "/(tabs)" : "/onboarding"} />;
}
