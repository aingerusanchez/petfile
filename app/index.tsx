import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
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
          err instanceof Error ? err.message : "No se pudo comprobar tu mascota",
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
      <View className="flex-1 items-center justify-center bg-base px-6">
        <Text className="mb-4 text-center text-error">{petCheckError}</Text>
        <Pressable
          testID="index-retry"
          onPress={retry}
          className="rounded-xl border border-border-strong px-6 py-3"
        >
          <Text className="text-text-secondary">Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (loading || (session && hasPet === null)) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color="#A5F2F3" />
      </View>
    );
  }

  if (!session) return <Redirect href="/login" />;
  return <Redirect href={hasPet ? "/(tabs)" : "/onboarding"} />;
}
