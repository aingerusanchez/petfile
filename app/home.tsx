import { Text, View } from "react-native";

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <Text testID="home-title" className="text-2xl text-text-primary">
        Hoy
      </Text>
    </View>
  );
}
