import { Pressable, Text, View } from "react-native";
import { useAuth } from "../../lib/auth";

export default function Profile() {
  const { signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-base px-6">
      <Text testID="profile-title" className="mb-8 text-2xl text-text-primary">
        Perfil
      </Text>
      <Pressable
        testID="profile-signout"
        onPress={signOut}
        className="rounded-xl border border-border-strong px-6 py-3"
      >
        <Text className="text-text-secondary">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
