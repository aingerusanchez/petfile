import { Redirect, Tabs } from "expo-router";
import { Footprints, HeartPulse, PawPrint } from "lucide-react-native";
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
        // The navigator draws its own labels, outside the `Text` wrapper that
        // applies the typeface everywhere else — so without this the only
        // permanent text in the app renders in the platform's face while the
        // rest of the screen is in Outfit. One typeface is a design rule.
        tabBarLabelStyle: { fontFamily: "Outfit_500Medium" },
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
      {/* "Diario", not "Hoy": the tab names the section and the screen names
          the day it is showing. Its icon is the same `Footprints` the walk
          action carries, which is the point rather than a clash — walks are
          most of what the diary holds, and a tutor who has learnt the glyph
          from the sheet reads it here for free. It survives next to the paw
          print two tabs along because the two are different drawings: a trail
          of prints going somewhere against one pad seen head-on. */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Diario",
          tabBarIcon: ({ color }) => <Footprints size={24} color={color} />,
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
          tabBarIcon: ({ color }) => <PawPrint size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
