import { Check, Hand, ShieldAlert, ShieldCheck } from "lucide-react-native";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ComposerMenuAnchor } from "@/components/model-switcher";
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
import type { AgentPermissionMode, AppLanguage } from "@/domain/preferences";

type PermissionSwitcherProps = {
  anchor: ComposerMenuAnchor | null;
  language: AppLanguage;
  onClose: () => void;
  onSelect: (mode: AgentPermissionMode) => void;
  selectedMode: AgentPermissionMode;
  visible: boolean;
};

const permissionOptions = [
  { id: "ask", icon: Hand },
  { id: "assist", icon: ShieldCheck },
  { id: "full", icon: ShieldAlert },
] as const;

/** Approval level uses the same anchored-menu grammar as model selection. */
export function PermissionSwitcher({
  anchor,
  language,
  onClose,
  onSelect,
  selectedMode,
  visible,
}: PermissionSwitcherProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const copy = permissionCopy[language];
  const menuWidth = Math.min(336, windowWidth - spacing.lg * 2);
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
            {permissionOptions.map((option) => {
              const selected = option.id === selectedMode;
              const Icon = option.icon;
              const optionCopy = copy.options[option.id];
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.rowPressable,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.permissionRow,
                      selected && styles.permissionRowSelected,
                    ]}
                  >
                    {selected ? (
                      <Check
                        color={
                          option.id === "full" ? palette.warning : palette.accent
                        }
                        size={iconSize.small}
                        strokeWidth={2.2}
                      />
                    ) : (
                      <Icon
                        color={palette.mist}
                        size={iconSize.small}
                        strokeWidth={1.7}
                      />
                    )}
                    <View style={styles.optionCopy}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.optionTitle,
                          selected &&
                            option.id === "full" &&
                            styles.fullAccessText,
                        ]}
                      >
                        {optionCopy.title}
                      </Text>
                      <Text numberOfLines={2} style={styles.optionDetail}>
                        {optionCopy.detail}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function permissionLabel(
  language: AppLanguage,
  mode: AgentPermissionMode,
) {
  return permissionCopy[language].options[mode].title;
}

const permissionCopy = {
  zh: {
    close: "关闭权限选择",
    options: {
      ask: {
        title: "请求批准",
        detail: "执行写入或外部操作前始终询问",
      },
      assist: {
        title: "帮我批准",
        detail: "只对敏感或不可逆操作请求批准",
      },
      full: {
        title: "完全访问",
        detail: "允许直接执行；系统权限仍由 iOS 管理",
      },
    },
  },
  en: {
    close: "Close permission picker",
    options: {
      ask: {
        title: "Ask for approval",
        detail: "Always ask before writes or external actions",
      },
      assist: {
        title: "Approve for me",
        detail: "Ask only for sensitive or irreversible actions",
      },
      full: {
        title: "Full access",
        detail: "Run directly; system access is still managed by iOS",
      },
    },
  },
} as const;

const menuShadow: ViewStyle = {
  shadowColor: palette.void,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.18,
  shadowRadius: 22,
  elevation: 12,
};

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  menu: {
    ...menuShadow,
    position: "absolute",
    maxHeight: "56%",
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.ink,
  },
  listScroll: { width: "100%", flexGrow: 0, flexShrink: 1 },
  list: { width: "100%", padding: spacing.xs },
  rowPressable: { width: "100%" },
  rowPressed: { opacity: 0.7 },
  permissionRow: {
    width: "100%",
    minHeight: 68,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  permissionRowSelected: { backgroundColor: palette.graphite },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  optionDetail: {
    marginTop: 2,
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 17,
  },
  fullAccessText: { color: palette.warning },
});
