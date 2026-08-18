import { useRouter } from "expo-router";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import type { AppLanguage } from "@/domain/preferences";
import { useContactFlow } from "@/store/use-contactflow";

const languages: { id: AppLanguage; label: string; detail: string }[] = [
  { id: "zh", label: "简体中文", detail: "Simplified Chinese" },
  { id: "en", label: "English", detail: "英语" },
];

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const setLanguage = useContactFlow((state) => state.setLanguage);
  const copy = languageCopy[language];

  return (
    <Screen
      backLabel={copy.back}
      eyebrow="PREFERENCES"
      onBack={() => router.back()}
      title={copy.title}
    >
      <SettingsGroup label={copy.section}>
        {languages.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <SettingsDivider inset={16} /> : null}
            <SettingsRow
              accessibilityLabel={`${copy.use} ${item.label}`}
              detail={item.detail}
              iconColor="#BFE3CA"
              onPress={() => setLanguage(item.id)}
              selected={language === item.id}
              showsDisclosure={false}
              title={item.label}
            />
          </View>
        ))}
      </SettingsGroup>
    </Screen>
  );
}

const languageCopy = {
  zh: { title: "语言", section: "应用语言", use: "使用", back: "返回设置" },
  en: { title: "Language", section: "App language", use: "Use", back: "Back to settings" },
} as const;
