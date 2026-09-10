import { Redirect, Tabs } from "expo-router";
import { LoadingScreen, colors } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.nav,
          borderTopColor: colors.borderDefault,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        // `textTertiary`, not `textMuted`: Slate Mist on Deep Ice measures
        // 3.83:1, which fails AA for a label this small — and a tab label is
        // the app's only permanent navigation, so it is the last text that
        // should be hard to read. This measures 7.12:1 and still sits far
        // below the active label's 14.42:1, so the distinction survives.
        tabBarInactiveTintColor: colors.textTertiary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Hoy" }} />
      <Tabs.Screen name="health" options={{ title: "Salud" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
