import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import { getMyPet } from "../lib/pets";

export default function Index() {
  const { session, loading } = useAuth();
  const [hasPet, setHasPet] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setHasPet(null);
      return;
    }
    getMyPet().then(({ pet }) => setHasPet(pet !== null));
  }, [session]);

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
