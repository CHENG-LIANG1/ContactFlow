import { useRouter } from "expo-router";
import { Bot, Plus } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";

import { Screen } from "@/components/screen";
import {
  SettingsDivider,
  SettingsGroup,
  SettingsRow,
} from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import {
  isChatCompletionsProvider,
  providerNames,
} from "@/domain/model-config";
import { useContactFlow } from "@/store/use-contactflow";

export default function ModelsScreen() {
  const router = useRouter();
  const language = useContactFlow((state) => state.language);
  const configs = useContactFlow((state) => state.modelConfigs);
  const selectedId = useContactFlow((state) => state.selectedModelConfigId);
  const copy = modelsCopy[language];

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={copy.title}
      trailing={
        <Pressable
          accessibilityLabel={copy.add}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push("/settings-model")}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Plus
            color={palette.paper}
            size={iconSize.medium}
            strokeWidth={1.8}
          />
        </Pressable>
      }
    >
      {configs.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Bot
              color={palette.accent}
              size={iconSize.large}
              strokeWidth={1.6}
            />
          </View>
          <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings-model")}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{copy.add}</Text>
          </Pressable>
        </Card>
      ) : (
        <SettingsGroup label={copy.configured}>
          {configs.map((config, index) => (
            <View key={config.id}>
              {index > 0 ? <SettingsDivider /> : null}
              <SettingsRow
                accessibilityLabel={`${config.model}, ${providerNames[config.provider]}, ${copy.edit}`}
                detail={`${providerNames[config.provider]}${
                  isChatCompletionsProvider(config.provider)
                    ? ""
                    : ` · ${copy.unsupported}`
                }`}
                icon={Bot}
                iconColor={palette.accent}
                onPress={() =>
                  router.push({
                    pathname: "/settings-model",
                    params: { id: config.id },
                  })
                }
                title={config.model}
                value={config.id === selectedId ? copy.inUse : undefined}
              />
            </View>
          ))}
        </SettingsGroup>
      )}

    </Screen>
  );
}

const modelsCopy = {
  zh: {
    title: "模型与 API",
    subtitle: "添加自己的模型服务。API Key 仅保存在系统安全存储中。",
    back: "返回设置",
    add: "添加模型",
    configured: "已配置模型",
    emptyTitle: "还没有模型",
    emptyBody: "添加 Provider、模型 ID、Base URL 和 API Key。",
    inUse: "使用中",
    edit: "编辑",
    unsupported: "协议暂未接通",
  },
  en: {
    title: "Models & API",
    subtitle: "Add your own model service. API keys stay in secure storage.",
    back: "Back to settings",
    add: "Add model",
    configured: "Configured models",
    emptyTitle: "No models yet",
    emptyBody: "Add a provider, model ID, Base URL, and API key.",
    inUse: "In use",
    edit: "Edit",
    unsupported: "Protocol not connected",
  },
} as const;

const styles = StyleSheet.create({
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderRadius: radius.md,
    backgroundColor: palette.ink,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.graphite,
  },
  emptyTitle: {
    marginTop: spacing.md,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.body,
    lineHeight: 22,
  },
  emptyBody: {
    marginTop: spacing.xs,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 44,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  primaryButtonText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  pressed: { opacity: 0.58 },
});
