import { Link } from "expo-router";
import { Text } from "react-native";
import { Screen } from "../components/ui";

/**
 * Our own not-found screen.
 *
 * Expo Router ships one, and it is a developer tool: it shows "Unmatched
 * Route" in English and offers a link to `/_sitemap`, which lists every route
 * in the app plus a System Information panel with NODE_ENV and the Expo and
 * Hermes versions. None of that is guarded by `__DEV__`, so it would ship — and
 * a tutor who follows a stale link would land on it. Defining this route
 * replaces it.
 */
export default function NotFound() {
  return (
    <Screen center>
      <Text className="mb-2 text-2xl font-bold text-text-primary">
        Por aquí no hay nada
      </Text>
      <Text className="mb-8 text-center text-text-tertiary">
        Puede que el enlace esté caducado.
      </Text>
      <Link href="/" replace asChild>
        <Text className="font-semibold text-accent-secondary">
          Volver al inicio
        </Text>
      </Link>
    </Screen>
  );
}
