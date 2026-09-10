import { Redirect, Tabs } from "expo-router";
import { Dog, HeartPulse, Sun } from "lucide-react-native";
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
      {/* Real icons, because the alternative is not "no icons": with no
          `tabBarIcon` the navigator renders its own placeholder, which on the
          web target came out as a "⏷" glyph — inside the accessible name too
          ("⏷ ⏷ Hoy"). A Unicode glyph standing in for an icon is the one thing
          The No-Glyph Rule bans, and Material's navigation bar expects icons
          anyway. Lucide at 24dp, tinted by the same active/inactive colours as
          the label. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Hoy",
          tabBarIcon: ({ color }) => <Sun size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: "Salud",
          tabBarIcon: ({ color }) => <HeartPulse size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <Dog size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
