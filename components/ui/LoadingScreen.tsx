import { ActivityIndicator } from "react-native";
import { Screen } from "./Screen";
import { colors } from "./tokens";

type LoadingScreenProps = {
  /** Announced by screen readers while the spinner is up. */
  label?: string;
  testID?: string;
};

/**
 * The full-screen busy state, previously duplicated across four route files
 * (`index`, `onboarding`, `(auth)/login`, `(tabs)/_layout`).
 */
export function LoadingScreen({ label = "Cargando", testID }: LoadingScreenProps) {
  return (
    <Screen center testID={testID}>
      <ActivityIndicator
        color={colors.accentPrimary}
        accessibilityRole="progressbar"
        accessibilityLabel={label}
      />
    </Screen>
  );
}
