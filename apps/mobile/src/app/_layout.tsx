import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Appearance } from "react-native";

import "../../global.css";

import { AppCanvasShell } from "@/components/app-canvas-shell";
import { fonts, motion, themeColors } from "@/constants/theme";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useContactFlow } from "@/store/use-contactflow";

export default function RootLayout() {
  const themeMode = useContactFlow((state) => state.themeMode);
  const colors = themeColors[themeMode];
  const theme = {
    dark: themeMode === "dark",
    colors: {
      primary: colors.accent,
      background: colors.void,
      card: colors.ink,
      text: colors.paper,
      border: colors.line,
      notification: colors.accent,
    },
    fonts: {
      regular: { fontFamily: fonts.body, fontWeight: "400" as const },
      medium: { fontFamily: fonts.bodyMedium, fontWeight: "500" as const },
      bold: { fontFamily: fonts.display, fontWeight: "600" as const },
      heavy: { fontFamily: fonts.display, fontWeight: "700" as const },
    },
  };

  useEffect(() => {
    Appearance.setColorScheme(themeMode);
    SystemUI.setBackgroundColorAsync(colors.void).catch(() => undefined);
  }, [colors.void, themeMode]);

  return (
    <GluestackUIProvider mode={themeMode}>
      <ThemeProvider value={theme}>
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
        <AppCanvasShell>
          <Stack screenOptions={{ animation: "none", headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen
              name="memory"
              options={{
                animation: "slide_from_right",
                animationDuration: motion.standard,
              }}
            />
            <Stack.Screen name="profile" />
            <Stack.Screen name="settings" />
            <Stack.Screen
              name="settings-models"
              options={{
                animation: "slide_from_right",
                animationDuration: motion.standard,
              }}
            />
            <Stack.Screen
              name="settings-model"
              options={{
                animation: "slide_from_right",
                animationDuration: motion.standard,
              }}
            />
            <Stack.Screen
              name="settings-language"
              options={{
                animation: "slide_from_right",
                animationDuration: motion.standard,
              }}
            />
            <Stack.Screen
              name="settings-theme"
              options={{
                animation: "slide_from_right",
                animationDuration: motion.standard,
              }}
            />
            <Stack.Screen
              name="settings-cache"
              options={{
                animation: "slide_from_right",
                animationDuration: motion.standard,
              }}
            />
          </Stack>
        </AppCanvasShell>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
