import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: failure } = await signInWithGoogle();
    setError(failure);
    setBusy(false);
  }

  return (
    <View className="flex-1 justify-center bg-base px-6">
      <Text className="mb-2 text-4xl font-bold text-text-primary">Petlife</Text>
      <Text className="mb-10 text-text-tertiary">El día a día de Loki</Text>

      {error ? (
        <Text testID="login-error" className="mb-3 text-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="login-google"
        disabled={busy}
        onPress={submit}
        className="items-center rounded-xl bg-accent-primary py-4"
      >
        {busy ? (
          <ActivityIndicator color="#0B1120" />
        ) : (
          <Text className="font-semibold text-on-accent">Continuar con Google</Text>
        )}
      </Pressable>
    </View>
  );
}
