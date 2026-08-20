import { useRouter } from "expo-router";
import { Bot, HardDrive, Languages, Palette } from "lucide-react-native";
import { StyleSheet } from "react-native";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { fonts, hues, palette, spacing, typeScale } from "@/constants/theme";
import { useContactFlow } from "@/store/use-contactflow";

export default function SettingsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const themeMode = useContactFlow((state) => state.themeMode);
  const sessions = useContactFlow((state) => state.chatSessions);
  const modelConfigs = useContactFlow((state) => state.modelConfigs);
  const copy = settingsCopy[language];
  const imageCount = sessions.reduce(
    (total, session) => total + session.turn.attachments.length,
    0,
  );

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
    >
      <SettingsGroup label={copy.preferences}>
        <SettingsRow
          icon={Languages}
          iconBackground={hues.blue.background}
          iconColor={hues.blue.foreground}
          onPress={() => router.push("/settings-language")}
          title={copy.language}
          value={language === "zh" ? "简体中文" : "English"}
        />
        <SettingsDivider />
        <SettingsRow
          icon={Palette}
          iconBackground={hues.violet.background}
          iconColor={hues.violet.foreground}
          onPress={() => router.push("/settings-theme")}
          title={copy.theme}
          value={themeMode === "light" ? copy.light : copy.dark}
          valueAccessory={
            <View
              style={[styles.accentDot, { backgroundColor: palette.accent }]}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label={copy.aiModels}>
        <SettingsRow
          detail={copy.modelsHint}
          icon={Bot}
          iconBackground={hues.green.background}
          iconColor={hues.green.foreground}
          onPress={() => router.push("/settings-models")}
          title={copy.models}
          value={`${modelConfigs.length} ${copy.modelsCount}`}
        />
      </SettingsGroup>

      <SettingsGroup label={copy.storage}>
        <SettingsRow
          detail={copy.cacheHint}
          icon={HardDrive}
          iconBackground={hues.orange.background}
          iconColor={hues.orange.foreground}
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
    aiModels: "AI 模型",
    models: "模型与 API",
    modelsCount: "个模型",
    modelsHint: "管理 Provider、Base URL 和 API Key",
    language: "语言",
    theme: "外观",
    light: "浅色",
    dark: "深色",
    cache: "缓存管理",
    conversations: "个会话",
    images: "张图片",
    cacheHint: "查看并清理聊天缓存",
    footnote: "设置保存在本机；API Key 安全存储在系统钥匙串中。",
    back: "返回对话",
  },
  en: {
    title: "Settings",
    preferences: "Preferences",
    storage: "On-device data",
    aiModels: "AI models",
    models: "Models & API",
    modelsCount: "models",
    modelsHint: "Manage providers, Base URLs, and API keys",
    language: "Language",
    theme: "Appearance",
    light: "Light",
    dark: "Dark",
    cache: "Cache",
    conversations: "chats",
    images: "images",
    cacheHint: "Review and clear chat cache",
    footnote: "Settings stay on-device. API keys use secure system storage.",
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
    fontSize: typeScale.caption,
    lineHeight: 17,
    paddingHorizontal: spacing.xs,
  },
});
