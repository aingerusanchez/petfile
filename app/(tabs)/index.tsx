import { Screen, Text } from "../../components/ui";

export default function Home() {
  // edges={["top"]}: the tab bar already clears the bottom inset.
  return (
    <Screen center edges={["top"]}>
      <Text
        testID="home-title"
        accessibilityRole="header"
        className="text-2xl text-text-primary"
      >
        Hoy
      </Text>
      {/* An empty state, not a roadmap note: it says what will live here in
          the tutor's terms rather than naming an internal plan. */}
      <Text className="mt-2 text-center text-text-tertiary">
        Aquí irá el día de tu perro: paseos, comidas y medicación.
      </Text>
    </Screen>
  );
}
