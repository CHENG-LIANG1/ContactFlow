import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";

import "../../global.css";

import { accentThemes, palette } from "@/constants/theme";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { useContactFlow } from "@/store/use-contactflow";

const contactFlowTheme = {
  dark: true,
  colors: {
    primary: palette.paper,
    background: palette.void,
    card: palette.ink,
    text: palette.paper,
    border: palette.line,
    notification: palette.paper,
  },
  fonts: {
    regular: { fontFamily: "AvenirNext-Regular", fontWeight: "400" as const },
    medium: { fontFamily: "AvenirNext-Medium", fontWeight: "500" as const },
    bold: { fontFamily: "AvenirNext-DemiBold", fontWeight: "600" as const },
    heavy: { fontFamily: "AvenirNext-Bold", fontWeight: "700" as const },
  },
};

export default function RootLayout() {
  const accentId = useContactFlow((state) => state.accentId);
  const theme = {
    ...contactFlowTheme,
    colors: {
      ...contactFlowTheme.colors,
      primary: accentThemes[accentId].color,
      notification: accentThemes[accentId].color,
    },
  };

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.void).catch(() => undefined);
  }, []);

  return (
    <GluestackUIProvider mode="dark">
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
