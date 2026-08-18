import { useRouter } from "expo-router";
import { HardDrive, Languages, Palette } from "lucide-react-native";
import { StyleSheet } from "react-native";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { accentThemes, fonts, palette, spacing } from "@/constants/theme";
import { useContactFlow } from "@/store/use-contactflow";

export default function SettingsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const accentId = useContactFlow((state) => state.accentId);
  const sessions = useContactFlow((state) => state.chatSessions);
  const copy = settingsCopy[language];
  const imageCount = sessions.reduce(
    (total, session) => total + session.turn.attachments.length,
    0,
  );

  return (
    <Screen
      backLabel={copy.back}
      eyebrow="PREFERENCES"
      onBack={() => router.back()}
      title={copy.title}
    >
      <SettingsGroup label={copy.preferences}>
        <SettingsRow
          icon={Languages}
          onPress={() => router.push("/settings-language")}
          title={copy.language}
          value={language === "zh" ? "简体中文" : "English"}
        />
        <SettingsDivider />
        <SettingsRow
          icon={Palette}
          iconColor={accentThemes[accentId].color}
          onPress={() => router.push("/settings-theme")}
          title={copy.theme}
          value={accentThemes[accentId].label}
          valueAccessory={
            <View
              style={[
                styles.accentDot,
                { backgroundColor: accentThemes[accentId].color },
              ]}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label={copy.storage}>
        <SettingsRow
          detail={copy.cacheHint}
          icon={HardDrive}
          onPress={() => router.push("/settings-cache")}
          title={copy.cache}
          value={`${sessions.length} ${copy.conversations} · ${imageCount} ${copy.images}`}
        />
      </SettingsGroup>

      <Text style={styles.footnote}>{copy.footnote}</Text>
    </Screen>
  );
}

const settingsCopy = {
  zh: {
    title: "设置",
    preferences: "偏好设置",
    storage: "本机数据",
    language: "语言",
    theme: "主题色",
    cache: "缓存管理",
    conversations: "个会话",
    images: "张图片",
    cacheHint: "查看并清理聊天缓存",
    footnote: "语言、主题和个人资料仅保存在这台设备上。",
    back: "返回对话",
  },
  en: {
    title: "Settings",
    preferences: "Preferences",
    storage: "On-device data",
    language: "Language",
    theme: "Accent color",
    cache: "Cache",
    conversations: "chats",
    images: "images",
    cacheHint: "Review and clear chat cache",
    footnote: "Language, theme, and profile settings stay on this device.",
    back: "Back to chat",
  },
} as const;

const styles = StyleSheet.create({
  accentDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  footnote: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
    paddingHorizontal: spacing.xs,
  },
});
