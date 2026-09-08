import { Text } from "react-native";
import { Button, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export default function Profile() {
  const { signOut } = useAuth();

  return (
    <Screen center edges={["top"]}>
      <Text testID="profile-title" className="mb-8 text-2xl text-text-primary">
        Perfil
      </Text>
      <Button testID="profile-signout" label="Cerrar sesión" onPress={signOut} />
    </Screen>
  );
}
