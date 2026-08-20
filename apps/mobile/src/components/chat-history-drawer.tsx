import {
  BrainCircuit,
  ChevronRight,
  MessageCircleMore,
  Pin,
  Search,
  Settings,
  SquarePen,
} from "lucide-react-native";
import ContextMenu from "react-native-context-menu-view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileAvatar } from "@/components/profile-avatar";
import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  motion,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { ChatSession } from "@/domain/chat";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useContactFlow } from "@/store/use-contactflow";

type ChatHistoryDrawerProps = {
  activeSessionId: string | null;
  onClose: () => void;
  onCloseStart?: () => void;
  onDelete: (id: string) => void;
  onMemory: () => void;
  onNewChat: () => void;
  onPin: (id: string) => void;
  onProfile: () => void;
  onRename: (id: string, title: string) => void;
  onSelect: (session: ChatSession) => void;
  onSettings: () => void;
  sessions: ChatSession[];
  visible: boolean;
};

/** Search, conversations, and account actions each keep a stable drawer zone. */
export function ChatHistoryDrawer({
  activeSessionId,
  onClose,
  onCloseStart,
  onDelete,
  onMemory,
  onNewChat,
  onPin,
  onProfile,
  onRename,
  onSelect,
  onSettings,
  sessions,
  visible,
}: ChatHistoryDrawerProps) {
  const [translateX] = useState(() => new Animated.Value(-380));
  const [scrimOpacity] = useState(() => new Animated.Value(0));
  const [query, setQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const closingRef = useRef(false);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const language = useContactFlow((state) => state.language);
  const profile = useContactFlow((state) => state.profile);
  const memories = useContactFlow((state) => state.memories);
  const history = useContactFlow((state) => state.history);
  const relationshipCount = useMemo(
    () =>
      new Set([
        ...memories.map((memory) => memory.contactName.trim()),
        ...history.map((record) => record.contactName.trim()),
      ]).size,
    [history, memories],
  );
  const copy = drawerCopy[language];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSessions = useMemo(() => {
    const matches = normalizedQuery
      ? sessions.filter((session) =>
          `${session.title} ${session.turn.note}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        )
      : sessions;
    return [...matches].sort(
      (left, right) =>
        Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)),
    );
  }, [normalizedQuery, sessions]);

  const saveRename = useCallback(() => {
    const nextTitle = renameTitle.trim();
    if (!renameTarget || !nextTitle) return;
    onRename(renameTarget.id, nextTitle);
    setRenameTarget(null);
    setRenameTitle("");
  }, [onRename, renameTarget, renameTitle]);

  const beginRename = useCallback((session: ChatSession) => {
    setTimeout(() => {
      setRenameTitle(session.title);
      setRenameTarget(session);
    }, 180);
  }, []);

  const confirmDelete = useCallback(
    (session: ChatSession) => {
      setTimeout(() => {
        Alert.alert(
          copy.deleteConfirmTitle,
          copy.deleteConfirmBody(session.title),
          [
            { text: copy.cancel, style: "cancel" },
            {
              text: copy.delete,
              style: "destructive",
              onPress: () => onDelete(session.id),
            },
          ],
        );
      }, 180);
    },
    [copy, onDelete],
  );

  const handleSessionMenuAction = useCallback(
    (session: ChatSession, actionIndex: number) => {
      if (actionIndex === 0) {
        onPin(session.id);
        return;
      }
      if (actionIndex === 1) {
        beginRename(session);
        return;
      }
      if (actionIndex === 2) confirmDelete(session);
    },
    [beginRename, confirmDelete, onPin],
  );

  // Native iOS menu: system handles preview, animation, and text colors.
  const sessionMenuActions = useCallback(
    (session: ChatSession) => [
      {
        title: session.isPinned ? copy.unpin : copy.pin,
        systemIcon: session.isPinned ? "pin.slash" : "pin",
      },
      { title: copy.rename, systemIcon: "pencil" },
      { title: copy.delete, systemIcon: "trash", destructive: true },
    ],
    [copy],
  );

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateX.setValue(-380);
    scrimOpacity.setValue(0);
    const opening = Animated.parallel([
      Animated.timing(translateX, {
        duration: reduceMotion ? 0 : motion.standard,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, {
        duration: reduceMotion ? 0 : motion.fast,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]);
    opening.start();
    return () => opening.stop();
  }, [reduceMotion, scrimOpacity, translateX, visible]);

  /** Reveal the destination first, then move it home with the closing drawer. */
  const closeThen = useCallback(
    (next?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      next?.();
      requestAnimationFrame(() => {
        onCloseStart?.();
        Animated.parallel([
          Animated.timing(translateX, {
            duration: reduceMotion ? 0 : motion.standard,
            easing: Easing.inOut(Easing.cubic),
            toValue: -380,
            useNativeDriver: true,
          }),
          Animated.timing(scrimOpacity, {
            duration: reduceMotion ? 0 : motion.fast,
            easing: Easing.in(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          closingRef.current = false;
          if (!finished) return;
          onClose();
        });
      });
    },
    [onClose, onCloseStart, reduceMotion, scrimOpacity, translateX],
  );

  const handleSessionPress = useCallback(
    (session: ChatSession) => {
      closeThen(() => onSelect(session));
    },
    [closeThen, onSelect],
  );

  return (
    <>
      <Modal
        animationType="none"
        onRequestClose={() => closeThen()}
        onShow={() => setQuery("")}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <Animated.View
            pointerEvents="box-none"
            style={[styles.scrim, { opacity: scrimOpacity }]}
          >
            <Pressable
              accessibilityLabel={copy.close}
              accessibilityRole="button"
              onPress={() => closeThen()}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            style={[styles.panel, { transform: [{ translateX }] }]}
          >
            <View
              style={[
                styles.safeArea,
                {
                  paddingTop: insets.top + spacing.sm,
                  paddingBottom: Math.max(
                    insets.bottom - spacing.md,
                    spacing.sm,
                  ),
                },
              ]}
            >
              <View style={styles.topBar}>
                <View style={styles.searchBox}>
                  <Search
                    color={palette.smoke}
                    size={iconSize.medium}
                    strokeWidth={1.7}
                  />
                  <TextInput
                    accessibilityLabel={copy.search}
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                    onChangeText={setQuery}
                    placeholder={copy.search}
                    placeholderTextColor={palette.smoke}
                    returnKeyType="search"
                    selectionColor={palette.accent}
                    style={styles.searchInput}
                    value={query}
                  />
                </View>
                <Pressable
                  accessibilityLabel={copy.newChat}
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => closeThen(onNewChat)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <View style={styles.topAction}>
                    <SquarePen
                      color={palette.paper}
                      size={iconSize.medium}
                      strokeWidth={1.7}
                    />
                  </View>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>{copy.recent}</Text>
              <ScrollView
                contentContainerStyle={styles.list}
                keyboardDismissMode="on-drag"
                keyboardShouldPersistTaps="handled"
                style={styles.listScroll}
                showsVerticalScrollIndicator={false}
              >
                {filteredSessions.length === 0 ? (
                  <View style={styles.empty}>
                    <MessageCircleMore
                      color={palette.smoke}
                      size={iconSize.large}
                      strokeWidth={1.4}
                    />
                    <Text style={styles.emptyTitle}>
                      {query ? copy.noResults : copy.emptyTitle}
                    </Text>
                    <Text style={styles.emptyBody}>
                      {query ? copy.noResultsBody : copy.emptyBody}
                    </Text>
                  </View>
                ) : (
                  filteredSessions.map((session) => {
                    const active = session.id === activeSessionId;
                    return (
                      <ContextMenu
                        actions={sessionMenuActions(session)}
                        dropdownMenuMode={false}
                        key={session.id}
                        onPress={(event) =>
                          handleSessionMenuAction(
                            session,
                            event.nativeEvent.index,
                          )
                        }
                      >
                        <Pressable
                          accessibilityActions={[
                            {
                              name: "pin",
                              label: session.isPinned ? copy.unpin : copy.pin,
                            },
                            { name: "rename", label: copy.rename },
                            { name: "delete", label: copy.delete },
                          ]}
                          accessibilityLabel={`${copy.openChat}: ${session.title}`}
                          accessibilityHint={copy.longPressHint}
                          accessibilityRole="button"
                          onAccessibilityAction={(event) => {
                            const action = event.nativeEvent.actionName;
                            handleSessionMenuAction(
                              session,
                              action === "pin" ? 0 : action === "rename" ? 1 : 2,
                            );
                          }}
                          onPress={() => handleSessionPress(session)}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <SessionRowContent
                            active={active}
                            copy={copy}
                            language={language}
                            session={session}
                          />
                        </Pressable>
                      </ContextMenu>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.memoryDivider} />
              <Pressable
                accessibilityLabel={copy.memory}
                accessibilityRole="button"
                onPress={() => closeThen(onMemory)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View style={styles.memoryNav}>
                  <View style={styles.memoryIcon}>
                    <BrainCircuit
                      color={palette.paper}
                      size={iconSize.small}
                      strokeWidth={1.7}
                    />
                  </View>
                  <View style={styles.memoryCopy}>
                    <Text style={styles.memoryTitle}>{copy.memory}</Text>
                    <Text style={styles.memoryMeta}>{copy.relationshipCount(relationshipCount)}</Text>
                  </View>
                </View>
              </Pressable>

              <View style={styles.footer}>
                <View style={styles.footerRow}>
                  <View style={styles.profileCell}>
                    <Pressable
                      accessibilityLabel={copy.profile}
                      accessibilityRole="button"
                      onPress={() => closeThen(onProfile)}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <View style={styles.profileRow}>
                        <ProfileAvatar
                          className="h-9 w-9"
                          initialStyle={styles.profileInitial}
                          name={profile.name}
                          style={{ backgroundColor: palette.accent }}
                          uri={profile.avatarUri}
                        />
                        <View style={styles.profileLabel}>
                          <Text numberOfLines={1} style={styles.profileName}>
                            {profile.name || copy.profile}
                          </Text>
                          <ChevronRight
                            color={palette.smoke}
                            size={iconSize.small}
                            strokeWidth={1.8}
                          />
                        </View>
                      </View>
                    </Pressable>
                  </View>
                  <View style={styles.footerActions}>
                    <FooterAction
                      accessibilityLabel={copy.settings}
                      icon={Settings}
                      onPress={() => closeThen(onSettings)}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
          {Boolean(renameTarget) ? (
            <View style={StyleSheet.absoluteFill}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.dialogOverlay}
              >
                <Pressable
                  accessibilityLabel={copy.cancel}
                  onPress={() => setRenameTarget(null)}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.renameDialog}>
                  <Text accessibilityRole="header" style={styles.renameDialogTitle}>
                    {copy.rename}
                  </Text>
                  <TextInput
                    accessibilityLabel={copy.chatName}
                    autoFocus
                    enterKeyHint="done"
                    maxLength={48}
                    onChangeText={setRenameTitle}
                    onSubmitEditing={saveRename}
                    placeholder={copy.chatName}
                    placeholderTextColor={palette.smoke}
                    returnKeyType="done"
                    selectionColor={palette.accent}
                    selectTextOnFocus
                    style={styles.renameInput}
                    value={renameTitle}
                  />
                  <View style={styles.renameActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setRenameTarget(null)}
                      style={({ pressed }) => [
                        styles.renameButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.renameCancel}>{copy.cancel}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!renameTitle.trim()}
                      onPress={saveRename}
                      style={({ pressed }) => [
                        styles.renameButton,
                        styles.renameSaveButton,
                        !renameTitle.trim() && styles.renameButtonDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.renameSave}>{copy.save}</Text>
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

function SessionRowContent({
  active,
  copy,
  language,
  session,
}: {
  active: boolean;
  copy: (typeof drawerCopy)[keyof typeof drawerCopy];
  language: "zh" | "en";
  session: ChatSession;
}) {
  return (
    <View
      style={[styles.session, active && styles.sessionActive]}
    >
      <View style={styles.sessionCopy}>
        <Text numberOfLines={1} style={styles.sessionTitle}>
          {session.title}
        </Text>
        <Text numberOfLines={1} style={styles.sessionMeta}>
          {formatSessionTime(session.updatedAt, language)}
          {session.turn.attachments.length > 0
            ? ` · ${copy.imageCount(session.turn.attachments.length)}`
            : ""}
        </Text>
      </View>
      <View style={styles.sessionTrailing}>
        {session.isPinned ? (
          <Pin color={palette.smoke} size={iconSize.small} strokeWidth={1.7} />
        ) : null}
        {active ? <View style={styles.activeDot} /> : null}
      </View>
    </View>
  );
}

function FooterAction({
  accessibilityLabel,
  icon: Icon,
  onPress,
}: {
  accessibilityLabel: string;
  icon: typeof Settings;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={styles.footerAction}>
        <Icon color={palette.mist} size={iconSize.medium} strokeWidth={1.6} />
      </View>
    </Pressable>
  );
}

function formatSessionTime(value: string, language: "zh" | "en") {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `${language === "zh" ? "今天" : "Today"} ${new Intl.DateTimeFormat(
      language === "zh" ? "zh-CN" : "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date)}`;
  }
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

const drawerCopy = {
  zh: {
    search: "搜索聊天记录",
    recent: "最近对话",
    newChat: "新对话",
    emptyTitle: "还没有聊天记录",
    emptyBody: "发送第一条消息后，会话会保存在这里。",
    noResults: "没有找到相关对话",
    noResultsBody: "换一个关键词试试。",
    settings: "设置",
    profile: "我的",
    manageChat: "对话操作",
    pin: "置顶",
    unpin: "取消置顶",
    rename: "编辑对话名称",
    delete: "删除对话",
    deleteConfirmTitle: "删除这条对话？",
    deleteConfirmBody: (title: string) => `“${title}”将从本机永久删除。`,
    chatName: "对话名称",
    save: "保存",
    cancel: "取消",
    longPressHint: "长按可置顶、编辑名称或删除",
    close: "关闭聊天记录",
    openChat: "打开聊天",
    memory: "记忆",
    relationshipCount: (count: number) => `${count} 位联系人`,
    imageCount: (count: number) => `${count} 张图片`,
  },
  en: {
    search: "Search chats",
    recent: "Recent chats",
    newChat: "New chat",
    emptyTitle: "No chats yet",
    emptyBody:
      "Your first conversation will appear here after you send a message.",
    noResults: "No matching chats",
    noResultsBody: "Try another keyword.",
    settings: "Settings",
    profile: "Profile",
    manageChat: "Chat actions",
    pin: "Pin to top",
    unpin: "Unpin",
    rename: "Edit chat name",
    delete: "Delete chat",
    deleteConfirmTitle: "Delete this chat?",
    deleteConfirmBody: (title: string) =>
      `“${title}” will be permanently deleted from this device.`,
    chatName: "Chat name",
    save: "Save",
    cancel: "Cancel",
    longPressHint: "Long press to pin, rename, or delete",
    close: "Close chat history",
    openChat: "Open chat",
    memory: "Memory",
    relationshipCount: (count: number) =>
      `${count} ${count === 1 ? "contact" : "contacts"}`,
    imageCount: (count: number) => `${count} image${count === 1 ? "" : "s"}`,
  },
} as const;

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  scrim: {
    position: "absolute",
    inset: 0,
    backgroundColor: palette.overlay,
  },
  panel: {
    width: "86%",
    maxWidth: 370,
    height: "100%",
    backgroundColor: palette.ink,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.line,
    shadowColor: palette.paper,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 10, height: 0 },
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  topBar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: palette.graphite,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    paddingVertical: 0,
  },
  topAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    lineHeight: 16,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  list: { paddingBottom: spacing.md, gap: 2 },
  listScroll: { flex: 1 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.hero,
  },
  emptyTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    marginTop: spacing.md,
  },
  emptyBody: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  session: {
    width: "100%",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  sessionActive: { backgroundColor: palette.graphite },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  sessionMeta: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 16,
    marginTop: 2,
  },
  sessionTrailing: {
    minWidth: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginRight: spacing.xs,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  memoryDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: palette.line,
  },
  memoryNav: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  memoryIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: palette.graphite,
  },
  memoryCopy: { flex: 1 },
  memoryTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  memoryMeta: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    marginTop: 2,
  },
  dialogOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.overlay,
    paddingHorizontal: spacing.xl,
  },
  renameDialog: {
    width: "100%",
    maxWidth: 330,
    borderRadius: radius.md,
    backgroundColor: palette.ink,
    padding: spacing.lg,
    shadowColor: palette.paper,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  renameDialogTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 18,
    lineHeight: 23,
  },
  renameInput: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.graphite,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.body,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  renameButton: {
    minWidth: 72,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
  },
  renameSaveButton: { backgroundColor: palette.accent },
  renameButtonDisabled: { opacity: 0.4 },
  renameCancel: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  renameSave: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    paddingTop: spacing.xs,
  },
  footerRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  profileCell: { flex: 1, minWidth: 0 },
  profileRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  profileInitial: {
    color: palette.void,
    fontFamily: fonts.display,
    fontSize: 16,
  },
  profileLabel: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  profileName: {
    flexShrink: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
  },
  footerActions: { flexDirection: "row", alignItems: "center" },
  footerAction: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.56 },
});
