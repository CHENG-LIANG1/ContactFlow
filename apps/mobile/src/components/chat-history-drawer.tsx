import {
  ChevronRight,
  MessageCircleMore,
  Plus,
  Settings,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  accentThemes,
  fonts,
  palette,
  radius,
  spacing,
} from "@/constants/theme";
import type { ChatSession } from "@/domain/chat";
import { useContactFlow } from "@/store/use-contactflow";

type ChatHistoryDrawerProps = {
  activeSessionId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onProfile: () => void;
  onSelect: (session: ChatSession) => void;
  onSettings: () => void;
  sessions: ChatSession[];
  visible: boolean;
};

/** The conversation archive stays quiet so the active agent remains primary. */
export function ChatHistoryDrawer({
  activeSessionId,
  onClose,
  onNewChat,
  onProfile,
  onSelect,
  onSettings,
  sessions,
  visible,
}: ChatHistoryDrawerProps) {
  const [translateX] = useState(() => new Animated.Value(-380));
  const language = useContactFlow((state) => state.language);
  const accentId = useContactFlow((state) => state.accentId);
  const profile = useContactFlow((state) => state.profile);
  const accent = accentThemes[accentId].color;
  const copy = drawerCopy[language];

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(-380);
    Animated.spring(translateX, {
      damping: 24,
      mass: 0.75,
      stiffness: 220,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateX, visible]);

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
        <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
          <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
            <View style={styles.header}>
              <View>
                <Text style={styles.brand}>CONTACTFLOW</Text>
                <Text accessibilityRole="header" style={styles.title}>
                  {copy.title}
                </Text>
              </View>
              <Pressable
                accessibilityLabel={copy.close}
                accessibilityRole="button"
                hitSlop={10}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.pressed,
                ]}
              >
                <X color={palette.mist} size={20} strokeWidth={1.6} />
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel={copy.newChat}
              accessibilityRole="button"
              onPress={onNewChat}
              style={({ pressed }) => [
                styles.newChat,
                { backgroundColor: accent },
                pressed && styles.pressed,
              ]}
            >
              <Plus color={palette.void} size={18} strokeWidth={2} />
              <Text style={styles.newChatText}>{copy.newChat}</Text>
            </Pressable>

            <View style={styles.rule} />

            <ScrollView
              contentContainerStyle={styles.list}
              style={styles.listScroll}
              showsVerticalScrollIndicator={false}
            >
              {sessions.length === 0 ? (
                <View style={styles.empty}>
                  <MessageCircleMore
                    color={palette.smoke}
                    size={25}
                    strokeWidth={1.4}
                  />
                  <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
                  <Text style={styles.emptyBody}>
                    {copy.emptyBody}
                  </Text>
                </View>
              ) : (
                sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  return (
                    <Pressable
                      accessibilityLabel={`${copy.openChat}: ${session.title}`}
                      accessibilityRole="button"
                      key={session.id}
                      onPress={() => onSelect(session)}
                      style={({ pressed }) => [
                        styles.session,
                        active && styles.sessionActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.sessionTopline}>
                        <Text numberOfLines={1} style={styles.sessionTitle}>
                          {session.title}
                        </Text>
                        {active ? (
                          <View
                            style={[styles.activeDot, { backgroundColor: accent }]}
                          />
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={styles.sessionPreview}>
                        {session.turn.note || `${session.turn.attachments.length} 张图片`}
                      </Text>
                      <Text style={styles.sessionTime}>
                        {formatSessionTime(session.updatedAt, language)}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.accountArea}>
              <Pressable
                accessibilityLabel={copy.settings}
                accessibilityRole="button"
                onPress={onSettings}
                style={({ pressed }) => [
                  styles.accountRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.accountIcon}>
                  <Settings color={palette.mist} size={18} strokeWidth={1.6} />
                </View>
                <Text style={styles.accountLabel}>{copy.settings}</Text>
                <ChevronRight color={palette.smoke} size={16} strokeWidth={1.5} />
              </Pressable>

              <Pressable
                accessibilityLabel={copy.profile}
                accessibilityRole="button"
                onPress={onProfile}
                style={({ pressed }) => [
                  styles.profileRow,
                  pressed && styles.pressed,
                ]}
              >
                <Avatar
                  className="h-11 w-11"
                  style={{ backgroundColor: accent }}
                >
                  {profile.avatarUri ? (
                    <AvatarImage source={{ uri: profile.avatarUri }} />
                  ) : null}
                  <AvatarFallbackText style={styles.profileInitial}>
                    {(profile.name || "U").slice(0, 1).toUpperCase()}
                  </AvatarFallbackText>
                </Avatar>
                <View style={styles.profileCopy}>
                  <Text numberOfLines={1} style={styles.profileName}>
                    {profile.name || copy.profile}
                  </Text>
                  <Text numberOfLines={1} style={styles.profileBio}>
                    {profile.bio || copy.editProfile}
                  </Text>
                </View>
                <ChevronRight color={palette.smoke} size={16} strokeWidth={1.5} />
              </Pressable>
            </View>
            <Text style={styles.localNote}>{copy.localOnly}</Text>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function formatSessionTime(value: string, language: "zh" | "en") {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `${language === "zh" ? "今天" : "Today"} ${new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)}`;
  }
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

const drawerCopy = {
  zh: {
    title: "聊天记录",
    newChat: "新对话",
    emptyTitle: "还没有聊天记录",
    emptyBody: "发送第一条消息后，会话会保存在这里。",
    settings: "设置",
    profile: "我的",
    editProfile: "编辑个人信息",
    localOnly: "聊天记录仅保存在本机",
    close: "关闭聊天记录",
    openChat: "打开聊天",
  },
  en: {
    title: "Chats",
    newChat: "New chat",
    emptyTitle: "No chats yet",
    emptyBody: "Your first conversation will appear here after you send a message.",
    settings: "Settings",
    profile: "Profile",
    editProfile: "Edit personal details",
    localOnly: "Chats are stored on this device",
    close: "Close chat history",
    openChat: "Open chat",
  },
} as const;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  panel: {
    width: "86%",
    maxWidth: 370,
    height: "100%",
    backgroundColor: "#111210",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.line,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 10, height: 0 },
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: 8,
    letterSpacing: 1.1,
  },
  title: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 21,
    marginTop: 3,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  newChat: {
    height: 46,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: palette.paper,
  },
  newChatText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
    marginTop: spacing.lg,
  },
  list: { paddingVertical: spacing.md, gap: spacing.xs },
  listScroll: { flex: 1 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.hero,
  },
  emptyTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    marginTop: spacing.md,
  },
  emptyBody: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  session: {
    minHeight: 82,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  sessionActive: { backgroundColor: palette.graphite },
  sessionTopline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sessionTitle: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.success,
  },
  sessionPreview: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 5,
  },
  sessionTime: {
    color: "#6E706A",
    fontFamily: fonts.utility,
    fontSize: 8,
    marginTop: 5,
  },
  localNote: {
    color: "#6E706A",
    fontFamily: fonts.utility,
    fontSize: 8,
    letterSpacing: 0.4,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  accountArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    paddingTop: spacing.sm,
  },
  accountRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  accountIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.graphite,
  },
  accountLabel: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  profileRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: {
    color: palette.void,
    fontFamily: fonts.display,
    fontSize: 20,
  },
  profileCopy: { flex: 1 },
  profileName: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  profileBio: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 3,
  },
  pressed: { opacity: 0.58 },
});
