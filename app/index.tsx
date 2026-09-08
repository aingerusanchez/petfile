import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { Button, LoadingScreen, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { getMyPet } from "../lib/pets";

export default function Index() {
  const { session, loading } = useAuth();
  const [hasPet, setHasPet] = useState<boolean | null>(null);
  const [petCheckError, setPetCheckError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setPetCheckError(null);
    setHasPet(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!session) {
      setHasPet(null);
      setPetCheckError(null);
      return;
    }

    let cancelled = false;
    getMyPet()
      .then(({ pet, error }) => {
        if (cancelled) return;
        if (error) {
          setPetCheckError(error);
          return;
        }
        setHasPet(pet !== null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPetCheckError(
          err instanceof Error ? err.message : "No hemos podido encontrar a tu perro",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

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
