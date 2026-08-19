import { Bot, Check, Settings } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box as View } from "@/components/ui/box";
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
  type ModelConfig,
} from "@/domain/model-config";
import type { AppLanguage } from "@/domain/preferences";

export type ComposerMenuAnchor = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type ModelSwitcherProps = {
  anchor: ComposerMenuAnchor | null;
  configs: ModelConfig[];
  language: AppLanguage;
  onClose: () => void;
  onManage: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  visible: boolean;
};

/** Model selection is a lightweight menu anchored to its composer control. */
export function ModelSwitcher({
  anchor,
  configs,
  language,
  onClose,
  onManage,
  onSelect,
  selectedId,
  visible,
}: ModelSwitcherProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const copy = switcherCopy[language];
  const menuWidth = Math.min(248, windowWidth - spacing.xl * 2);
  const left = Math.min(
    Math.max(anchor?.x ?? spacing.lg, spacing.lg),
    windowWidth - menuWidth - spacing.lg,
  );
  const bottom = Math.max(
    anchor ? windowHeight - anchor.y + spacing.sm : insets.bottom + 132,
    insets.bottom + spacing.lg,
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={copy.close}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.menu, { bottom, left, width: menuWidth }]}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            style={styles.listScroll}
          >
            {configs.length === 0 ? (
              <View style={styles.empty}>
                <Bot
                  color={palette.smoke}
                  size={iconSize.medium}
                  strokeWidth={1.6}
                />
                <Text style={styles.emptyText}>{copy.empty}</Text>
              </View>
            ) : (
              configs.map((config) => {
                const selected = config.id === selectedId;
                const supported = isChatCompletionsProvider(config.provider);
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ disabled: !supported, selected }}
                    disabled={!supported}
                    key={config.id}
                    onPress={() => {
                      onSelect(config.id);
                      onClose();
                    }}
                    style={({ pressed }) => [
                      styles.rowPressable,
                      !supported && styles.rowDisabled,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.modelRow,
                        selected && styles.modelRowSelected,
                      ]}
                    >
                      <View style={styles.modelIcon}>
                        <Bot
                          color={selected ? palette.accent : palette.mist}
                          size={iconSize.small}
                          strokeWidth={1.7}
                        />
                      </View>
                      <View style={styles.modelCopy}>
                        <Text numberOfLines={1} style={styles.modelName}>
                          {config.model}
                        </Text>
                        <Text numberOfLines={1} style={styles.modelDetail}>
                          {providerNames[config.provider]}
                          {!supported ? ` · ${copy.unsupported}` : ""}
                        </Text>
                      </View>
                      {selected ? (
                        <Check
                          color={palette.accent}
                          size={iconSize.medium}
                          strokeWidth={2}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClose();
              requestAnimationFrame(onManage);
            }}
            style={({ pressed }) => [
              styles.rowPressable,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.manageRow}>
              <Settings
                color={palette.mist}
                size={iconSize.small}
                strokeWidth={1.7}
              />
              <Text style={styles.manageText}>{copy.manage}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const switcherCopy = {
  zh: {
    empty: "还没有配置模型",
    manage: "管理模型与 API",
    close: "关闭模型选择",
    unsupported: "协议暂未接通",
  },
  en: {
    empty: "No models configured",
    manage: "Manage models & API",
    close: "Close model picker",
    unsupported: "Not connected",
  },
} as const;

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  menu: {
    position: "absolute",
    maxHeight: "52%",
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.ink,
    shadowColor: palette.void,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  listScroll: { width: "100%", flexGrow: 0, flexShrink: 1 },
  list: { width: "100%", padding: spacing.xs },
  rowPressable: { width: "100%" },
  rowDisabled: { opacity: 0.46 },
  modelRow: {
    width: "100%",
    minHeight: 54,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  modelRowSelected: { backgroundColor: palette.graphite },
  rowPressed: { opacity: 0.7 },
  modelIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.void,
  },
  modelCopy: { flex: 1, minWidth: 0 },
  modelName: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  modelDetail: {
    marginTop: 1,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 17,
  },
  empty: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
  },
  manageRow: {
    width: "100%",
    minHeight: 46,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lineSoft,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  manageText: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
  },
});
