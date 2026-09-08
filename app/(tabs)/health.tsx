import { Screen, Text } from "../../components/ui";

export default function Health() {
  return (
    <Screen center edges={["top"]}>
      <Text testID="health-title" className="text-2xl text-text-primary">
        Salud
      </Text>
    </Screen>
  );
}
