import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  CircleAlert,
  Image as ImageIcon,
  Menu as MenuIcon,
  MessageCircleMore,
  RotateCcw,
} from "lucide-react-native";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ActionCard } from "@/components/action-card";
import { AnalysisProcess } from "@/components/analysis-process";
import { useAppCanvas } from "@/components/app-canvas-shell";
import { AssistantOutput } from "@/components/assistant-output";
import { ChatComposer } from "@/components/chat-composer";
import { InsightCard } from "@/components/insight-card";
import {
  type ComposerMenuAnchor,
  ModelSwitcher,
} from "@/components/model-switcher";
import { PermissionSwitcher } from "@/components/permission-switcher";
import { Box as View } from "@/components/ui/box";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
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
  isActionValidForExecution,
  normalizeActionProposal,
  proposalsFromAnalysis,
  type ActionProposal,
  type AgentAnalysis,
  type Insight,
} from "@/domain/actions";
import type { ChatAttachment, ChatSession } from "@/domain/chat";
import { resolveModelConfig } from "@/domain/model-config";
import { SAMPLE_CONTEXT } from "@/domain/sample-context";
import type { AppLanguage } from "@/domain/preferences";
import {
  ActionCancelledError,
  executeNativeAction,
} from "@/native/action-executor";
import {
  agentErrorMessage,
  analyzeContext,
  generateInsights,
  type AnalysisProgressStage,
} from "@/services/openai-compatible-agent";
import { useContactFlow } from "@/store/use-contactflow";

type UserTurn = { note: string; attachments: ChatAttachment[] };

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sessionIdSeed = useId();
  const newSessionIndexRef = useRef(0);
  const sentInSessionRef = useRef(false);
  const {
    activeSessionId,
    chatIntent,
    consumeChatIntent,
    openDrawer,
    setActiveSessionId,
  } = useAppCanvas();
  const language = useContactFlow((state) => state.language);
  const actions = useContactFlow((state) => state.actions);
  const insights = useContactFlow((state) => state.insights);
  const memories = useContactFlow((state) => state.memories);
  const setActions = useContactFlow((state) => state.setActions);
  const setInsights = useContactFlow((state) => state.setInsights);
  const updateActionPayload = useContactFlow(
    (state) => state.updateActionPayload,
  );
  const setActionExecuting = useContactFlow(
    (state) => state.setActionExecuting,
  );
  const failAction = useContactFlow((state) => state.failAction);
  const completeAction = useContactFlow((state) => state.completeAction);
  const saveChatSession = useContactFlow((state) => state.saveChatSession);
  const updateChatSessionAnalysis = useContactFlow(
    (state) => state.updateChatSessionAnalysis,
  );
  const modelConfigs = useContactFlow((state) => state.modelConfigs);
  const selectedModelConfigId = useContactFlow(
    (state) => state.selectedModelConfigId,
  );
  const selectModelConfig = useContactFlow((state) => state.selectModelConfig);
  const permissionMode = useContactFlow((state) => state.permissionMode);
  const setPermissionMode = useContactFlow((state) => state.setPermissionMode);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMeta, setAnalysisMeta] = useState<Omit<
    AgentAnalysis,
    "actions"
  > | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisElapsedMs, setAnalysisElapsedMs] = useState(0);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [analysisStage, setAnalysisStage] =
    useState<AnalysisProgressStage>("preparing_input");
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const analysisModelConfigIdRef = useRef<string | null>(null);
  const lastInsightActionRef = useRef<ActionProposal | null>(null);
  const [modelMenuAnchor, setModelMenuAnchor] =
    useState<ComposerMenuAnchor | null>(null);
  const [permissionMenuAnchor, setPermissionMenuAnchor] =
    useState<ComposerMenuAnchor | null>(null);
  const copy = chatCopy[language];
  const accent = palette.accent;
  const activeModel = resolveModelConfig(modelConfigs, selectedModelConfigId);
  const [turn, setTurn] = useState<UserTurn | null>(() =>
    actions.length > 0
      ? {
          note: SAMPLE_CONTEXT,
          attachments: [{ label: "聊天截图 · 示例", isDemo: true }],
        }
      : null,
  );

  useEffect(() => {
    if (!analyzing || analysisStartedAt === null) return;
    const updateElapsed = () =>
      setAnalysisElapsedMs(Date.now() - analysisStartedAt);
    updateElapsed();
    const timer = setInterval(updateElapsed, 100);
    return () => clearInterval(timer);
  }, [analyzing, analysisStartedAt]);

  const send = async (note: string, attachments: ChatAttachment[]) => {
    const startedAt = new Date().getTime();
    if (!activeSessionId) newSessionIndexRef.current += 1;
    const sessionId =
      activeSessionId ?? `chat-${sessionIdSeed}-${newSessionIndexRef.current}`;
    const updatedAt = new Date().toISOString();
    const nextTurn = { note, attachments };
    setActiveSessionId(sessionId);
    saveChatSession({
      id: sessionId,
      title: titleForTurn(note, attachments.length),
      modelConfigId: activeModel?.id,
      turn: nextTurn,
      updatedAt,
    });
    sentInSessionRef.current = true;
    setTurn(nextTurn);
    setActions([]);
    setAnalysisMeta(null);
    setAnalysisError(null);
    setAnalysisElapsedMs(0);
    setAnalysisStartedAt(startedAt);
    setAnalysisStage("preparing_input");
    setInsightError(null);
    setAnalyzing(true);
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    await Haptics.selectionAsync();
    if (!activeModel) {
      setAnalysisError(
        language === "zh"
          ? "还没有可用模型，请先在模型设置中添加并选择一个模型。"
          : "No model is configured. Add and select one in model settings.",
      );
      setAnalysisElapsedMs(new Date().getTime() - startedAt);
      setAnalyzing(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    analysisModelConfigIdRef.current = activeModel.id;
    try {
      const result = await analyzeContext({
        attachments,
        config: activeModel,
        locale: language === "zh" ? "zh-CN" : "en-US",
        memories,
        note,
        now: new Date(),
        onProgress: setAnalysisStage,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const durationMs = new Date().getTime() - startedAt;
      const nextActions = proposalsFromAnalysis(result);
      const meta = {
        contextSummary: result.contextSummary,
        notices: result.notices,
        participantNames: result.participantNames,
      };
      setActions(nextActions);
      setAnalysisMeta(meta);
      updateChatSessionAnalysis(
        sessionId,
        {
          ...meta,
          actions: nextActions,
        },
        durationMs,
      );
      setAnalysisElapsedMs(durationMs);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (error) {
      setAnalysisError(
        agentErrorMessage(error, language === "zh" ? "zh-CN" : "en-US"),
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAnalysisElapsedMs(new Date().getTime() - startedAt);
      setAnalyzing(false);
    }
  };

  const startNewChat = useCallback(() => {
    sentInSessionRef.current = false;
    setActiveSessionId(null);
    setTurn(null);
    setActions([]);
    setAnalysisMeta(null);
    setAnalysisError(null);
    setAnalysisElapsedMs(0);
    setAnalysisStartedAt(null);
    setAnalysisStage("preparing_input");
    setInsightError(null);
    setAnalyzing(false);
  }, [setActions, setActiveSessionId]);

  const openSession = useCallback(
    (session: ChatSession) => {
      sentInSessionRef.current = false;
      setActiveSessionId(session.id);
      setTurn(session.turn);
      setActions(
        session.analysis?.actions.map(normalizeActionProposal) ?? [],
      );
      setAnalysisMeta(
        session.analysis
          ? {
              contextSummary: session.analysis.contextSummary,
              notices: session.analysis.notices,
              participantNames: session.analysis.participantNames,
            }
          : null,
      );
      setAnalysisError(null);
      setAnalysisElapsedMs(session.analysisDurationMs ?? 0);
      setAnalysisStartedAt(null);
      setAnalysisStage("validating_schema");
      setInsightError(null);
      setAnalyzing(false);
      analysisModelConfigIdRef.current = session.modelConfigId ?? null;
      if (session.modelConfigId) selectModelConfig(session.modelConfigId);
    },
    [selectModelConfig, setActions, setActiveSessionId],
  );

  useEffect(() => {
    if (!chatIntent) return;
    const frame = requestAnimationFrame(() => {
      if (chatIntent.type === "session") openSession(chatIntent.session);
      else startNewChat();
      consumeChatIntent(chatIntent.key);
    });
    return () => cancelAnimationFrame(frame);
  }, [chatIntent, consumeChatIntent, openSession, startNewChat]);

  useEffect(() => {
    if (!activeSessionId || !analysisMeta) return;
    updateChatSessionAnalysis(activeSessionId, {
      ...analysisMeta,
      actions,
    });
  }, [
    actions,
    activeSessionId,
    analysisMeta,
    updateChatSessionAnalysis,
  ]);

  const requestInsights = async (action: ActionProposal) => {
    const modelConfig =
      modelConfigs.find(
        (config) => config.id === analysisModelConfigIdRef.current,
      ) ?? activeModel;
    if (!modelConfig) {
      setInsightError(copy.insightModelMissing);
      return;
    }
    lastInsightActionRef.current = action;
    setInsightGenerating(true);
    setInsightError(null);
    try {
      const result = await generateInsights({
        action: { ...action, status: "succeeded" },
        config: modelConfig,
        contextSummary: analysisMeta?.contextSummary ?? "",
        locale: language === "zh" ? "zh-CN" : "en-US",
        memories: useContactFlow.getState().memories,
      });
      const createdAt = new Date().toISOString();
      const nextInsights: Insight[] = result.insights.map((insight, index) => ({
        ...insight,
        id: `insight-${action.id}-${index}`,
        createdAt,
      }));
      setInsights(nextInsights);
    } catch (error) {
      setInsightError(
        agentErrorMessage(error, language === "zh" ? "zh-CN" : "en-US"),
      );
    } finally {
      setInsightGenerating(false);
    }
  };

  const execute = async (action: ActionProposal) => {
    const executableAction = normalizeActionProposal(action);
    if (!isActionValidForExecution(executableAction)) {
      failAction(action.id, copy.invalidAction);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setActionExecuting(action.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const receipt = await executeNativeAction(executableAction);
      completeAction(action.id, receipt);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await requestInsights(executableAction);
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
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
          style={styles.keyboardView}
        >
          <ChatHeader language={language} onOpenChats={openDrawer} />

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
                <AnalysisProcess
                  attachmentCount={turn?.attachments.length ?? 0}
                  elapsedMs={analysisElapsedMs}
                  key={analysisStage}
                  language={language}
                  modelName={activeModel?.model ?? copy.modelFallback}
                  stage={analysisStage}
                />
              </AgentMessage>
            ) : null}

            {!analyzing && analysisError ? (
              <AgentMessage>
                <StatusMessage
                  actionLabel={copy.retryAnalysis}
                  message={analysisError}
                  onAction={() => {
                    if (turn) void send(turn.note, turn.attachments);
                  }}
                />
              </AgentMessage>
            ) : null}

            {!analyzing && !analysisError && analysisMeta && actions.length === 0 ? (
              <AgentMessage>
                <StatusMessage
                  message={
                    analysisMeta.notices.map((notice) => notice.message).join("\n") ||
                    copy.noAction
                  }
                />
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
                    elapsedMs={analysisElapsedMs || undefined}
                    language={language}
                    message={
                      language === "zh"
                        ? `我找到了 ${actions.length} 个可以继续推进的动作。`
                        : `I found ${actions.length} actionable next step${actions.length === 1 ? "" : "s"}.`
                    }
                    reasoning={
                      [
                        language === "zh"
                          ? `已读取 ${turn?.attachments.length ?? 0} 张截图与当前文字`
                          : `Read ${turn?.attachments.length ?? 0} images and the current note`,
                        language === "zh"
                          ? `${activeModel?.model ?? copy.modelFallback} 已返回 JSON Schema 结果`
                          : `${activeModel?.model ?? copy.modelFallback} returned a JSON Schema result`,
                        language === "zh"
                          ? "ContactFlow Schema 校验通过"
                          : "ContactFlow schema validation passed",
                        analysisMeta?.contextSummary,
                        ...(analysisMeta?.notices.map(
                          (notice) => notice.message,
                        ) ?? []),
                      ]
                        .filter(Boolean)
                        .join("\n") || copy.analysisComplete
                    }
                  >
                    <Text style={styles.agentSecondary}>
                      {copy.actionDetail}
                    </Text>
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
                          permissionMode={permissionMode}
                        />
                      ))}
                    </View>
                  </AssistantOutput>
                </AgentMessage>
              </View>
            ) : null}

            {insightGenerating ? (
              <AgentMessage>
                <View style={styles.thinkingRow}>
                  <Spinner color={palette.paper} size="small" />
                  <Text style={styles.agentSecondary}>
                    {copy.insightGenerating}
                  </Text>
                </View>
              </AgentMessage>
            ) : null}

            {!insightGenerating && insightError ? (
              <AgentMessage>
                <StatusMessage
                  actionLabel={copy.retryInsight}
                  message={`${copy.actionSucceededInsightFailed}\n${insightError}`}
                  onAction={() => {
                    if (lastInsightActionRef.current) {
                      void requestInsights(lastInsightActionRef.current);
                    }
                  }}
                />
              </AgentMessage>
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

          <View
            style={[
              styles.composerDock,
              { paddingBottom: insets.bottom + spacing.sm },
            ]}
          >
            <ChatComposer
              accent={accent}
              analyzing={analyzing}
              language={language}
              modelName={activeModel?.model}
              onModelPress={(anchor) => {
                setPermissionMenuAnchor(null);
                setModelMenuAnchor(anchor);
              }}
              onPermissionPress={(anchor) => {
                setModelMenuAnchor(null);
                setPermissionMenuAnchor(anchor);
              }}
              onSend={send}
              permissionMode={permissionMode}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <ModelSwitcher
        anchor={modelMenuAnchor}
        configs={modelConfigs}
        language={language}
        onClose={() => setModelMenuAnchor(null)}
        onManage={() => router.push("/settings-models")}
        onSelect={selectModelConfig}
        selectedId={activeModel?.id ?? null}
        visible={modelMenuAnchor !== null}
      />
      <PermissionSwitcher
        anchor={permissionMenuAnchor}
        language={language}
        onClose={() => setPermissionMenuAnchor(null)}
        onSelect={setPermissionMode}
        selectedMode={permissionMode}
        visible={permissionMenuAnchor !== null}
      />
    </View>
  );
}

function ChatHeader({
  language,
  onOpenChats,
}: {
  language: AppLanguage;
  onOpenChats: () => void;
}) {
  const copy = chatCopy[language];

  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
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
          <MenuIcon
            color={palette.paper}
            size={iconSize.medium}
            strokeWidth={1.7}
          />
        </Pressable>
      </View>
      <View style={styles.headerCopy}>
        <Text numberOfLines={1} style={styles.headerTitle}>
          ContactFlow Agent
        </Text>
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]} />
    </View>
  );
}

function titleForTurn(note: string, imageCount: number) {
  const normalized = note.trim().replace(/\s+/g, " ");
  if (normalized) {
    return normalized.length > 24 ? `${normalized.slice(0, 24)}…` : normalized;
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
                  <ImageIcon
                    color={palette.void}
                    size={iconSize.medium}
                    strokeWidth={1.7}
                  />
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
      <MessageCircleMore
        color={palette.smoke}
        size={iconSize.medium}
        strokeWidth={1.5}
      />
      <Text style={styles.emptyText}>{chatCopy[language].emptyPrompt}</Text>
    </View>
  );
}

function StatusMessage({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.statusMessage}>
      <CircleAlert
        color={palette.warning}
        size={iconSize.medium}
        strokeWidth={1.6}
      />
      <View style={styles.statusCopy}>
        <Text style={styles.agentSecondary}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.pressed,
            ]}
          >
            <RotateCcw
              color={palette.void}
              size={iconSize.small}
              strokeWidth={1.8}
            />
            <Text style={styles.retryText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
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
    modelFallback: "所选模型",
    actionDetail: "你可以直接修改卡片；点击执行后，我还会再向你确认一次。",
    invalidAction: "卡片包含空值或无效时间，请修正后再执行。",
    analysisComplete: "已完成结构化分析。",
    retryAnalysis: "重新分析",
    noAction: "没有找到证据充分、可以安全执行的动作。",
    insightIntro: "这次执行带来了以下关系提醒：",
    insightGenerating: "正在结合已确认记忆生成关系洞察…",
    retryInsight: "重试洞察",
    actionSucceededInsightFailed: "系统动作已经成功，但洞察生成失败。",
    insightModelMissing: "原分析使用的模型已被删除，暂时无法生成洞察。",
    emptyPrompt: "从下方添加截图，或选择一个示例开始",
    openChats: "打开聊天记录",
  },
  en: {
    welcome: "Send me chat screenshots and tell me what you want to do.",
    welcomeDetail:
      "I’ll identify people, timing, and commitments, then suggest editable actions. Nothing reaches Calendar or Contacts without your confirmation.",
    thinking: "Understanding this conversation",
    thinkingDetail: "Finding people, timing, and actionable next steps…",
    modelFallback: "the selected model",
    actionDetail:
      "Edit any card first. I’ll ask again before writing to the system.",
    invalidAction: "This card has an empty field or invalid time. Fix it before executing.",
    analysisComplete: "Structured analysis is complete.",
    retryAnalysis: "Retry analysis",
    noAction: "I found no evidence-backed action that is safe to execute.",
    insightIntro: "This action created these relationship reminders:",
    insightGenerating: "Generating insights from confirmed memory…",
    retryInsight: "Retry insight",
    actionSucceededInsightFailed:
      "The system action succeeded, but insight generation failed.",
    insightModelMissing:
      "The model used for this analysis was deleted, so insights cannot be generated.",
    emptyPrompt: "Add screenshots below, or start with an example",
    openChats: "Open chat history",
  },
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.void },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    width: "100%",
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.lineSoft,
    backgroundColor: palette.void,
  },
  headerSide: {
    position: "absolute",
    left: spacing.md,
    width: 44,
    alignItems: "flex-start",
  },
  headerSideRight: {
    left: undefined,
    right: spacing.md,
    alignItems: "flex-end",
  },
  headerCopy: {
    width: "68%",
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  headerTitle: {
    flexShrink: 1,
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.body,
    lineHeight: 22,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    borderColor: palette.line,
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
    backgroundColor: palette.accent,
    shadowColor: palette.paper,
    shadowOpacity: 0.7,
    shadowRadius: 5,
  },
  agentText: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.body,
    lineHeight: 24,
  },
  agentSecondary: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thinkingCopy: { flex: 1 },
  statusMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.line,
    backgroundColor: palette.ink,
    padding: spacing.md,
  },
  statusCopy: { flex: 1, gap: spacing.md },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.md,
  },
  retryText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.caption,
  },
  userRow: { alignItems: "flex-end", paddingLeft: 48 },
  userBubble: {
    maxWidth: "94%",
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: palette.accent,
    padding: spacing.md,
  },
  userText: {
    color: palette.void,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.label,
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
    backgroundColor: palette.lineSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  userImageLabel: {
    color: palette.void,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
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
    fontSize: typeScale.caption,
  },
  actionList: { gap: spacing.md, marginTop: spacing.lg },
  composerDock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: palette.void,
  },
  pressed: { opacity: 0.55 },
});
