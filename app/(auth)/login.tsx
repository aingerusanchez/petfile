import { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { Screen, colors } from "../../components/ui";
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
    <Screen className="justify-center">
      <Text className="mb-2 text-4xl font-bold text-text-primary">Petlife</Text>
      <Text className="mb-10 text-text-tertiary">El día a día de Loki</Text>

      {error ? (
        <Text
          testID="login-error"
          accessibilityLiveRegion="polite"
          className="mb-3 text-error"
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        testID="login-google"
        disabled={busy}
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel="Continuar con Google"
        accessibilityState={{ disabled: busy, busy }}
        className="items-center rounded-xl bg-accent-primary py-4"
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text className="font-semibold text-on-accent">Continuar con Google</Text>
        )}
      </Pressable>
    </Screen>
  );
}
