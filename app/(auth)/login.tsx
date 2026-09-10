import { useState } from "react";
import { Button, GoogleMark, Screen, Text, Version } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen
      className="justify-center"
      footer={<Version testID="login-version" />}
    >
      <Text
        accessibilityRole="header"
        className="mb-2 font-bold text-4xl text-text-primary"
      >
        Petfile
      </Text>
      {/* "Diario" does in Spanish what "file" does in the name: the daily act
          of logging, and the notebook the history accumulates in. */}
      <Text className="mb-10 text-text-tertiary">El diario de tu compi</Text>

      {error ? (
        <Text
          testID="login-error"
          accessibilityLiveRegion="polite"
          className="mb-3 text-error"
        >
          {error}
        </Text>
      ) : null}

      {/* Outlined, not accent-filled: signing in with Google is the third
          party's affordance, and the accent means "the one thing to do here"
          *in this app*. The mark keeps its own brand colours — see
          GoogleMark. */}
      <Button
        testID="login-google"
        variant="outlined"
        leading={<GoogleMark size={20} />}
        label="Continuar con Google"
        errorLabel="No se pudo iniciar sesión"
        onPress={async () => {
          setError(null);
          const { error: failure } = await signInWithGoogle();
          setError(failure);
          return !failure;
        }}
      />
    </Screen>
  );
}
