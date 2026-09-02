import { Text, View } from "react-native";

export default function Health() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <Text testID="health-title" className="text-2xl text-text-primary">
        Salud
      </Text>
    </View>
  );
}
