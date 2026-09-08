import { Text } from "react-native";
import { Screen } from "../../components/ui";

export default function Home() {
  // edges={["top"]}: the tab bar already clears the bottom inset.
  return (
    <Screen center edges={["top"]}>
      <Text testID="home-title" className="text-2xl text-text-primary">
        Hoy
      </Text>
      <Text className="mt-2 text-center text-text-tertiary">
        El checklist del día llega en el plan de rutinas
      </Text>
    </Screen>
  );
}
