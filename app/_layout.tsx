import "../global.css";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CelebrationProvider, ToastProvider, colors } from "../components/ui";
import { AuthProvider } from "../lib/auth";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // SafeAreaProvider must sit above every screen: `Screen` consumes the
    // window insets through `useSafeAreaInsets()`, and the Stack below renders
    // with `headerShown: false`, so nothing else accounts for the Android
    // status bar or system navigation bar.
    <SafeAreaProvider>
      <AuthProvider>
        {/* Above the Stack on purpose: a toast rendered by a screen would be
            unmounted by its own success navigation. */}
        <ToastProvider>
          <CelebrationProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.base },
              }}
            />
          </CelebrationProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
