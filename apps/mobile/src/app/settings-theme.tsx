import { useRouter } from "expo-router";
import { Moon, Sun } from "lucide-react-native";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import { hues } from "@/constants/theme";
import type { ThemeMode } from "@/domain/preferences";
import { useContactFlow } from "@/store/use-contactflow";

const modes: ThemeMode[] = ["light", "dark"];

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const themeMode = useContactFlow((state) => state.themeMode);
  const setThemeMode = useContactFlow((state) => state.setThemeMode);
  const copy = themeCopy[language];

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
    >
      <SettingsGroup label={copy.section}>
        {modes.map((mode, index) => (
          <View key={mode}>
            {index > 0 ? <SettingsDivider inset={16} /> : null}
            <SettingsRow
              accessibilityLabel={`${copy.use} ${copy[mode]}`}
              icon={mode === "light" ? Sun : Moon}
              iconBackground={hues.violet.background}
              iconColor={hues.violet.foreground}
              onPress={() => setThemeMode(mode)}
              selected={themeMode === mode}
              showsDisclosure={false}
              title={copy[mode]}
            />
          </View>
        ))}
      </SettingsGroup>
    </Screen>
  );
}

const themeCopy = {
  zh: {
    title: "外观",
    section: "主题",
    use: "使用主题",
    light: "浅色",
    dark: "深色",
    back: "返回设置",
  },
  en: {
    title: "Appearance",
    section: "Theme",
    use: "Use theme",
    light: "Light",
    dark: "Dark",
    back: "Back to settings",
  },
} as const;
