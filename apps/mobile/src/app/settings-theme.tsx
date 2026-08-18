import { useRouter } from "expo-router";
import { StyleSheet } from "react-native";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import { accentThemes } from "@/constants/theme";
import type { AccentId } from "@/domain/preferences";
import { useContactFlow } from "@/store/use-contactflow";

const accentIds = Object.keys(accentThemes) as AccentId[];

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const accentId = useContactFlow((state) => state.accentId);
  const setAccentId = useContactFlow((state) => state.setAccentId);
  const copy = themeCopy[language];

  return (
    <Screen
      backLabel={copy.back}
      eyebrow="PREFERENCES"
      onBack={() => router.back()}
      title={copy.title}
    >
      <SettingsGroup label={copy.section}>
        {accentIds.map((item, index) => {
          const theme = accentThemes[item];
          return (
            <View key={item}>
              {index > 0 ? <SettingsDivider inset={16} /> : null}
              <SettingsRow
                accessibilityLabel={`${copy.use} ${theme.label}`}
                iconColor={theme.color}
                onPress={() => setAccentId(item)}
                selected={accentId === item}
                showsDisclosure={false}
                title={theme.label}
                valueAccessory={
                  <View style={[styles.swatch, { backgroundColor: theme.color }]} />
                }
              />
            </View>
          );
        })}
      </SettingsGroup>
    </Screen>
  );
}

const themeCopy = {
  zh: { title: "主题色", section: "强调色", use: "使用主题色", back: "返回设置" },
  en: { title: "Accent color", section: "Accent", use: "Use accent", back: "Back to settings" },
} as const;

const styles = StyleSheet.create({
  swatch: { width: 22, height: 22, borderRadius: 11 },
});
