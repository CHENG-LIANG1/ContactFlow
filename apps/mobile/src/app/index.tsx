import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Ellipsis,
  Image as ImageIcon,
  MessageCircleMore,
  PanelLeft,
  SquarePen,
} from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionCard } from "@/components/action-card";
import { AssistantOutput } from "@/components/assistant-output";
import { ChatComposer } from "@/components/chat-composer";
import { ChatHistoryDrawer } from "@/components/chat-history-drawer";
import { InsightCard } from "@/components/insight-card";
import { Box as View } from "@/components/ui/box";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import {
  accentThemes,
  fonts,
  palette,
  radius,
  spacing,
} from "@/constants/theme";
import type { ActionProposal } from "@/domain/actions";
import type { ChatAttachment, ChatSession } from "@/domain/chat";
import { analyzeDemoContext, SAMPLE_CONTEXT } from "@/domain/demo-agent";
import type { AppLanguage } from "@/domain/preferences";
import {
  ActionCancelledError,
  executeNativeAction,
} from "@/native/action-executor";
import { useContactFlow } from "@/store/use-contactflow";

type UserTurn = { note: string; attachments: ChatAttachment[] };

export default function ChatScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const sentInSessionRef = useRef(false);
  const chatSessions = useContactFlow((state) => state.chatSessions);
  const language = useContactFlow((state) => state.language);
  const accentId = useContactFlow((state) => state.accentId);
  const actions = useContactFlow((state) => state.actions);
  const insights = useContactFlow((state) => state.insights);
  const setActions = useContactFlow((state) => state.setActions);
  const updateActionPayload = useContactFlow(
    (state) => state.updateActionPayload,
  );
  const setActionExecuting = useContactFlow(
    (state) => state.setActionExecuting,
  );
  const failAction = useContactFlow((state) => state.failAction);
  const completeAction = useContactFlow((state) => state.completeAction);
  const saveChatSession = useContactFlow((state) => state.saveChatSession);
  const [analyzing, setAnalyzing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const copy = chatCopy[language];
  const accent = accentThemes[accentId].color;
  const [turn, setTurn] = useState<UserTurn | null>(() =>
    actions.length > 0
      ? {
          note: SAMPLE_CONTEXT,
          attachments: [{ label: "聊天截图 · 示例", isDemo: true }],
        }
      : null,
  );

  const send = async (note: string, attachments: ChatAttachment[]) => {
    const sessionId = activeSessionId ?? `chat-${Date.now()}`;
    const updatedAt = new Date().toISOString();
    const nextTurn = { note, attachments };
    setActiveSessionId(sessionId);
    saveChatSession({
      id: sessionId,
      title: titleForTurn(note, attachments.length),
      turn: nextTurn,
      updatedAt,
    });
    sentInSessionRef.current = true;
    setTurn(nextTurn);
    setActions([]);
    setAnalyzing(true);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    await Haptics.selectionAsync();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setActions(analyzeDemoContext(note || "请分析这些聊天截图"));
    setAnalyzing(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const startNewChat = () => {
    sentInSessionRef.current = false;
    setActiveSessionId(null);
    setDrawerOpen(false);
    setTurn(null);
    setActions([]);
    setAnalyzing(false);
  };

  const openSession = (session: ChatSession) => {
    sentInSessionRef.current = false;
    setActiveSessionId(session.id);
    setTurn(session.turn);
    setActions(
      analyzeDemoContext(session.turn.note || "请分析这些聊天截图"),
    );
    setAnalyzing(false);
    setDrawerOpen(false);
  };

  const execute = async (action: ActionProposal) => {
    setActionExecuting(action.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const receipt = await executeNativeAction(action);
      completeAction(action.id, receipt);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message =
        error instanceof ActionCancelledError
          ? error.message
          : error instanceof Error
            ? error.message
            : "系统写入失败，请检查权限后重试。";
      failAction(action.id, message);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
          style={styles.keyboardView}
        >
          <ChatHeader
            accent={accent}
            language={language}
            onHistory={() => router.push("/history")}
            onMemory={() => router.push("/memory")}
            onNewChat={startNewChat}
            onOpenChats={() => setDrawerOpen(true)}
          />

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.timeline}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AgentMessage>
              <Text style={styles.agentText}>{copy.welcome}</Text>
              <Text style={styles.agentSecondary}>{copy.welcomeDetail}</Text>
            </AgentMessage>

            {turn ? (
              <UserMessage language={language} turn={turn} />
            ) : (
              <EmptyPrompt language={language} />
            )}

            {analyzing ? (
              <AgentMessage>
                <View style={styles.thinkingRow}>
                  <Spinner color={palette.paper} size="small" />
                  <View style={styles.thinkingCopy}>
                    <Text style={styles.agentText}>{copy.thinking}</Text>
                    <Text style={styles.agentSecondary}>
                      {copy.thinkingDetail}
                    </Text>
                  </View>
                </View>
              </AgentMessage>
            ) : null}

            {!analyzing && actions.length > 0 ? (
              <View
                onLayout={(event) => {
                  if (!sentInSessionRef.current) return;
                  scrollRef.current?.scrollTo({
                    animated: true,
                    y: Math.max(0, event.nativeEvent.layout.y - spacing.lg),
                  });
                }}
              >
                <AgentMessage>
                  <AssistantOutput
                    language={language}
                    message={
                      language === "zh"
                        ? `我找到了 ${actions.length} 个可以继续推进的动作。`
                        : `I found ${actions.length} actionable next step${actions.length === 1 ? "" : "s"}.`
                    }
                    reasoning={
                      language === "zh"
                        ? "识别对话中的人物与关系\n提取时间、地点和明确承诺\n生成可编辑、需确认的行动卡片"
                        : "Identify people and relationships\nExtract timing, place, and commitments\nGenerate editable actions that require confirmation"
                    }
                  >
                    <Text style={styles.agentSecondary}>{copy.actionDetail}</Text>
                    <View style={styles.actionList}>
                      {actions.map((action) => (
                        <ActionCard
                          accent={accent}
                          action={action}
                          key={action.id}
                          language={language}
                          onChange={(patch) =>
                            updateActionPayload(action.id, patch)
                          }
                          onExecute={() => execute(action)}
                        />
                      ))}
                    </View>
                  </AssistantOutput>
                </AgentMessage>
              </View>
            ) : null}

            {insights.length > 0 ? (
              <AgentMessage>
                <AssistantOutput
                  language={language}
                  message={copy.insightIntro}
                  reasoning={
                    language === "zh"
                      ? "读取已确认且执行成功的事实\n结合当前对话生成关系提醒"
                      : "Read confirmed, successfully executed facts\nCombine them with the current conversation"
                  }
                >
                  <View style={styles.actionList}>
                    {insights.map((insight) => (
                      <InsightCard
                        insight={insight}
                        key={insight.id}
                        language={language}
                      />
                    ))}
                  </View>
                </AssistantOutput>
              </AgentMessage>
            ) : null}
          </ScrollView>

          <View style={styles.composerDock}>
            <ChatComposer
              accent={accent}
              analyzing={analyzing}
              language={language}
              onSend={send}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <ChatHistoryDrawer
        activeSessionId={activeSessionId}
        onClose={() => setDrawerOpen(false)}
        onNewChat={startNewChat}
        onProfile={() => {
          setDrawerOpen(false);
          router.push("/profile");
        }}
        onSelect={openSession}
        onSettings={() => {
          setDrawerOpen(false);
          router.push("/settings");
        }}
        sessions={chatSessions}
        visible={drawerOpen}
      />
    </View>
  );
}

function ChatHeader({
  accent,
  language,
  onHistory,
  onMemory,
  onNewChat,
  onOpenChats,
}: {
  accent: string;
  language: AppLanguage;
  onHistory: () => void;
  onMemory: () => void;
  onNewChat: () => void;
  onOpenChats: () => void;
}) {
  const copy = chatCopy[language];
  const openMenu = () => {
    Alert.alert("ContactFlow", copy.menuDetail, [
      { text: copy.actionHistory, onPress: onHistory },
      { text: copy.agentMemory, onPress: onMemory },
      { text: copy.cancel, style: "cancel" },
    ]);
  };

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={copy.openChats}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenChats}
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.pressed,
        ]}
      >
        <PanelLeft color={palette.paper} size={21} strokeWidth={1.6} />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>ContactFlow Agent</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: accent }]} />
          <Text style={styles.headerStatus}>{copy.online}</Text>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel={copy.more}
          accessibilityRole="button"
          hitSlop={8}
          onPress={openMenu}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ellipsis color={palette.mist} size={21} strokeWidth={1.7} />
        </Pressable>
        <Pressable
          accessibilityLabel={copy.newChat}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onNewChat}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <SquarePen color={palette.paper} size={20} strokeWidth={1.6} />
        </Pressable>
      </View>
    </View>
  );
}

function titleForTurn(note: string, imageCount: number) {
  const normalized = note.trim().replace(/\s+/g, " ");
  if (normalized) {
    return normalized.length > 24
      ? `${normalized.slice(0, 24)}…`
      : normalized;
  }
  return imageCount === 1 ? "图片对话" : `${imageCount} 张图片`;
}

function AgentMessage({ children }: { children: ReactNode }) {
  return (
    <View style={styles.agentRow}>
      <AgentMark />
      <View style={styles.agentContent}>{children}</View>
    </View>
  );
}

function AgentMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.agentMark, compact && styles.agentMarkCompact]}>
      <View style={styles.agentOrbit} />
      <View style={styles.agentCore} />
    </View>
  );
}

function UserMessage({
  language,
  turn,
}: {
  language: AppLanguage;
  turn: UserTurn;
}) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        {turn.attachments.length > 0 ? (
          <View style={styles.userAttachments}>
            {turn.attachments.map((attachment, index) =>
              attachment.uri ? (
                <Image
                  key={`${attachment.uri}-${index}`}
                  source={{ uri: attachment.uri }}
                  style={styles.userImage}
                />
              ) : (
                <View
                  key={`${attachment.label}-${index}`}
                  style={styles.userImagePlaceholder}
                >
                  <ImageIcon color={palette.void} size={19} strokeWidth={1.7} />
                  <Text style={styles.userImageLabel}>
                    {language === "zh" ? "示例" : "Demo"}
                  </Text>
                </View>
              ),
            )}
          </View>
        ) : null}
        {turn.note ? <Text style={styles.userText}>{turn.note}</Text> : null}
      </View>
    </View>
  );
}

function EmptyPrompt({ language }: { language: AppLanguage }) {
  return (
    <View style={styles.emptyPrompt}>
      <MessageCircleMore color={palette.smoke} size={17} strokeWidth={1.5} />
      <Text style={styles.emptyText}>{chatCopy[language].emptyPrompt}</Text>
    </View>
  );
}

const chatCopy = {
  zh: {
    welcome: "把聊天截图发给我，再补一句你想做什么。",
    welcomeDetail:
      "我会理解人物、时间和承诺，先给你可编辑的行动建议；没有你的确认，我不会写入日历或通讯录。",
    thinking: "正在理解这段对话",
    thinkingDetail: "识别人物、时间和可以执行的下一步…",
    actionDetail: "你可以直接修改卡片；点击执行后，我还会再向你确认一次。",
    insightIntro: "这次执行带来了一条关系提醒：",
    emptyPrompt: "从下方添加截图，或选择一个示例开始",
    online: "在线 · 本地模式",
    menuDetail: "查看 Agent 的执行记录与已确认记忆。",
    actionHistory: "行动记录",
    agentMemory: "Agent 记忆",
    cancel: "取消",
    openChats: "打开聊天记录",
    more: "打开更多选项",
    newChat: "开始新对话",
  },
  en: {
    welcome: "Send me chat screenshots and tell me what you want to do.",
    welcomeDetail:
      "I’ll identify people, timing, and commitments, then suggest editable actions. Nothing reaches Calendar or Contacts without your confirmation.",
    thinking: "Understanding this conversation",
    thinkingDetail: "Finding people, timing, and actionable next steps…",
    actionDetail: "Edit any card first. I’ll ask again before writing to the system.",
    insightIntro: "This action created a relationship reminder:",
    emptyPrompt: "Add screenshots below, or start with an example",
    online: "Online · On-device",
    menuDetail: "View executed actions and confirmed agent memory.",
    actionHistory: "Action history",
    agentMemory: "Agent memory",
    cancel: "Cancel",
    openChats: "Open chat history",
    more: "Open more options",
    newChat: "Start a new chat",
  },
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.void },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.lineSoft,
    backgroundColor: "rgba(9,10,9,0.97)",
  },
  headerCopy: { flex: 1, marginLeft: spacing.md },
  headerTitle: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.success,
  },
  headerStatus: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  timeline: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  agentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  agentContent: { flex: 1, paddingTop: 2 },
  agentMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(247,246,238,0.36)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.ink,
  },
  agentMarkCompact: { width: 36, height: 36, borderRadius: 18 },
  agentOrbit: {
    position: "absolute",
    width: 18,
    height: 9,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.smoke,
    transform: [{ rotate: "-28deg" }],
  },
  agentCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.paper,
    shadowColor: palette.paper,
    shadowOpacity: 0.7,
    shadowRadius: 5,
  },
  agentText: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  agentSecondary: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thinkingCopy: { flex: 1 },
  userRow: { alignItems: "flex-end", paddingLeft: 48 },
  userBubble: {
    maxWidth: "94%",
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: palette.paper,
    padding: spacing.md,
  },
  userText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
  },
  userAttachments: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: spacing.sm,
  },
  userImage: { width: 72, height: 72, borderRadius: radius.sm },
  userImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: "rgba(9,10,9,0.08)",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  userImageLabel: {
    color: palette.void,
    fontFamily: fonts.utility,
    fontSize: 8,
  },
  emptyPrompt: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: palette.line,
  },
  emptyText: {
    color: palette.smoke,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  actionList: { gap: spacing.md, marginTop: spacing.lg },
  composerDock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: "rgba(9,10,9,0.98)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lineSoft,
  },
  pressed: { opacity: 0.55 },
});
