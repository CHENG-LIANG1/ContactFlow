import { MenuView } from "@expo/ui/community/menu";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, Trash2 } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, StyleSheet } from "react-native";

import { Screen } from "@/components/screen";
import { SettingsGroup } from "@/components/settings-list";
import { Box as View } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
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
  modelProviders,
  isChatCompletionsProvider,
  providerBaseUrls,
  providerNames,
  type ModelProvider,
} from "@/domain/model-config";
import { useContactFlow } from "@/store/use-contactflow";

export default function ModelEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const language = useContactFlow((state) => state.language);
  const configs = useContactFlow((state) => state.modelConfigs);
  const createModelConfig = useContactFlow((state) => state.createModelConfig);
  const updateModelConfig = useContactFlow((state) => state.updateModelConfig);
  const deleteModelConfig = useContactFlow((state) => state.deleteModelConfig);
  const existing = useMemo(
    () => configs.find((config) => config.id === id),
    [configs, id],
  );
  const copy = editorCopy[language];
  const [provider, setProvider] = useState<ModelProvider>(
    existing?.provider ?? "openai",
  );
  const [model, setModel] = useState(existing?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(
    existing?.baseUrl ?? providerBaseUrls.openai,
  );
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const chooseProvider = (nextProvider: ModelProvider) => {
    const knownBaseUrl = Object.values(providerBaseUrls).includes(baseUrl);
    setProvider(nextProvider);
    if (!baseUrl || knownBaseUrl) setBaseUrl(providerBaseUrls[nextProvider]);
  };

  const save = async () => {
    if (!model.trim() || !baseUrl.trim()) {
      setError(copy.requiredError);
      return;
    }
    if (!existing && !apiKey.trim()) {
      setError(copy.apiKeyError);
      return;
    }
    if (!/^https?:\/\//i.test(baseUrl.trim())) {
      setError(copy.urlError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = { provider, model, baseUrl, apiKey };
      if (existing) await updateModelConfig(existing.id, input);
      else await createModelConfig(input);
      router.back();
    } catch {
      setError(copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = () => {
    if (!existing) return;
    Alert.alert(copy.deleteTitle, copy.deleteBody(existing.model), [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteModelConfig(existing.id);
            router.back();
          } catch {
            Alert.alert(copy.deleteError);
          }
        },
      },
    ]);
  };

  return (
    <Screen
      backLabel={copy.back}
      onBack={() => router.back()}
      title={existing ? copy.editTitle : copy.addTitle}
    >
      <SettingsGroup label={copy.provider}>
        <MenuView
          actions={modelProviders.map((item) => ({
            id: item,
            state: provider === item ? "on" : "off",
            title: `${providerNames[item]}${
              isChatCompletionsProvider(item) ? "" : ` · ${copy.unsupported}`
            }`,
          }))}
          onPressAction={({ nativeEvent }) =>
            chooseProvider(nativeEvent.event as ModelProvider)
          }
          style={styles.providerMenu}
        >
          <View
            accessibilityLabel={`${copy.provider}: ${providerNames[provider]}`}
            accessibilityRole="button"
            accessible
            style={styles.providerRow}
          >
            <Text style={styles.providerName}>{providerNames[provider]}</Text>
            <ChevronDown
              color={palette.smoke}
              size={iconSize.medium}
              strokeWidth={1.7}
            />
          </View>
        </MenuView>
      </SettingsGroup>

      <Card style={styles.formCard}>
        <ModelField
          autoCapitalize="none"
          label={copy.model}
          onChangeText={setModel}
          placeholder={copy.modelPlaceholder}
          value={model}
        />
        <ModelField
          autoCapitalize="none"
          keyboardType="url"
          label="Base URL"
          onChangeText={setBaseUrl}
          placeholder="https://api.example.com/v1"
          value={baseUrl}
        />
        <ModelField
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
          detail={existing?.hasApiKey ? copy.keySaved : copy.keyPrivate}
          importantForAutofill="no"
          label="API Key"
          onChangeText={setApiKey}
          placeholder={existing?.hasApiKey ? copy.keyPlaceholder : "sk-…"}
          secureTextEntry
          textContentType="none"
          value={apiKey}
        />
      </Card>

      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        className="active:opacity-70"
        disabled={saving}
        onPress={() => void save()}
        style={[styles.saveButton, saving && styles.buttonDisabled]}
      >
        <Text style={styles.saveButtonText}>
          {saving ? copy.saving : copy.save}
        </Text>
      </Pressable>

      {existing ? (
        <Pressable
          accessibilityRole="button"
          className="active:opacity-70"
          onPress={requestDelete}
          style={styles.deleteButton}
        >
          <Trash2
            color={palette.danger}
            size={iconSize.medium}
            strokeWidth={1.7}
          />
          <Text style={styles.deleteText}>{copy.delete}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function ModelField({
  detail,
  label,
  ...inputProps
}: {
  detail?: string;
  label: string;
} & React.ComponentProps<typeof InputField>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Input style={styles.input}>
        <InputField
          maxFontSizeMultiplier={1.35}
          placeholderTextColor={palette.smoke}
          selectionColor={palette.accent}
          style={styles.inputField}
          {...inputProps}
        />
      </Input>
      {detail ? <Text style={styles.fieldDetail}>{detail}</Text> : null}
    </View>
  );
}

const editorCopy = {
  zh: {
    addTitle: "添加模型",
    editTitle: "编辑模型",
    addSubtitle: "填写服务信息后即可在对话框上方切换。",
    editSubtitle: "修改模型信息；API Key 留空会保留原值。",
    back: "返回模型列表",
    provider: "Provider",
    model: "模型 ID",
    modelPlaceholder: "例如：gpt-5-mini",
    keySaved: "已安全保存；留空则不修改。",
    keyPrivate: "只保存在系统安全存储中。",
    keyPlaceholder: "已保存，输入新值可替换",
    requiredError: "请填写显示名称、模型 ID 和 Base URL。",
    apiKeyError: "请输入 API Key。",
    urlError: "Base URL 需要以 http:// 或 https:// 开头。",
    saveError: "保存失败，请稍后重试。",
    save: "保存模型",
    saving: "正在保存…",
    delete: "删除模型",
    deleteTitle: "删除这个模型？",
    deleteBody: (name: string) => `“${name}”的配置和 API Key 都会从本机删除。`,
    deleteError: "删除失败，请稍后重试。",
    cancel: "取消",
    unsupported: "协议暂未接通",
  },
  en: {
    addTitle: "Add model",
    editTitle: "Edit model",
    addSubtitle: "After saving, switch models above the composer.",
    editSubtitle: "Edit model details. Leave API Key blank to keep it.",
    back: "Back to models",
    provider: "Provider",
    model: "Model ID",
    modelPlaceholder: "For example: gpt-5-mini",
    keySaved: "Stored securely. Leave blank to keep it.",
    keyPrivate: "Stored only in secure system storage.",
    keyPlaceholder: "Saved; enter a new value to replace it",
    requiredError: "Enter a display name, model ID, and Base URL.",
    apiKeyError: "Enter an API key.",
    urlError: "Base URL must start with http:// or https://.",
    saveError: "Could not save. Try again.",
    save: "Save model",
    saving: "Saving…",
    delete: "Delete model",
    deleteTitle: "Delete this model?",
    deleteBody: (name: string) =>
      `The configuration and API key for “${name}” will be removed from this device.`,
    deleteError: "Could not delete. Try again.",
    cancel: "Cancel",
    unsupported: "Not connected",
  },
} as const;

const styles = StyleSheet.create({
  providerMenu: { width: "100%" },
  providerRow: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  providerName: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  formCard: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: palette.ink,
  },
  field: { gap: spacing.xs },
  fieldLabel: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  input: {
    height: 44,
    borderRadius: radius.sm,
    borderColor: palette.line,
    backgroundColor: palette.void,
  },
  inputField: {
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
  },
  fieldDetail: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 17,
  },
  error: {
    color: palette.danger,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    marginTop: -spacing.md,
  },
  saveButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  saveButtonText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  deleteButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  deleteText: {
    color: palette.danger,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  buttonDisabled: { opacity: 0.45 },
});
