import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useLocalRuntime,
  type AssistantRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react-native";
import { ArrowUp, Menu as MenuIcon, X } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useAppCanvas } from "@/components/app-canvas-shell";
import {
  ChatActionsContext,
  ChatAssistantMessage,
  ChatUserMessage,
  StatusMessage,
  TimelineHeader,
} from "@/components/chat-messages";
import { ChatComposer } from "@/components/chat-composer";
import {
  type ComposerMenuAnchor,
  ModelSwitcher,
} from "@/components/model-switcher";
import { PermissionSwitcher } from "@/components/permission-switcher";
import { Box as View } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { ThinkingDots } from "@/components/thinking-dots";
import { Text } from "@/components/ui/text";
import {
  fonts,
  iconSize,
  palette,
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
import type { ChatAttachment, ChatSession, ChatTurn } from "@/domain/chat";
import { resolveModelConfig } from "@/domain/model-config";
import { SAMPLE_CONTEXT } from "@/domain/sample-context";
import type { AppLanguage } from "@/domain/preferences";
import {
  ActionCancelledError,
  executeNativeAction,
} from "@/native/action-executor";
import {
  agentErrorMessage,
  generateInsights,
  type PreviousAnalysisTurn,
} from "@/services/openai-compatible-agent";
import {
  createAnalysisAdapter,
  resultReasoning,
  resultText,
  type AnalysisBridge,
} from "@/services/analysis-runtime";
import { useContactFlow } from "@/store/use-contactflow";

type QueuedTurn = { id: string; note: string; attachments: ChatAttachment[] };

function toMessageAttachments(attachments: ChatAttachment[]) {
  return attachments.map((attachment, index) => ({
    id: `att-${index}-${attachment.label}`,
    type: "image" as const,
    name: attachment.label,
    contentType: "image/jpeg",
    content: attachment.uri
      ? [{ type: "image" as const, image: attachment.uri }]
      : [],
    status: { type: "complete" as const },
  }));
}

/** Rebuilds the assistant-ui message list for a persisted chat session. */
function messagesForSession(
  session: ChatSession,
  language: AppLanguage,
  modelName: string,
): ThreadMessageLike[] {
  const messages: ThreadMessageLike[] = [
    {
      role: "user",
      content: session.turn.note
        ? [{ type: "text", text: session.turn.note }]
        : [],
      attachments: toMessageAttachments(session.turn.attachments),
    },
  ];
  if (session.analysis) {
    const custom: Record<string, unknown> = {
      kind: session.analysis.actions.length > 0 ? "actions" : undefined,
    };
    if (session.analysisDurationMs) {
      custom.elapsedMs = session.analysisDurationMs;
    }
    messages.push({
      role: "assistant",
      content: [
        {
          type: "reasoning",
          text: resultReasoning({
            attachmentCount: session.turn.attachments.length,
            language,
            modelName,
            result: session.analysis,
          }),
        },
        {
          type: "text",
          text: resultText({
            actionCount: session.analysis.actions.length,
            language,
            notices: session.analysis.notices,
          }),
        },
      ],
      metadata: { custom },
    });
  } else if (session.analysisError) {
    // A failed run is restored as an error message so it stays retryable.
    messages.push({
      role: "assistant",
      content: [],
      metadata: {
        custom: { errorText: session.analysisError, kind: "error" },
      },
    });
  }
  return messages;
}

/** Demo conversation seeded on first launch so the canvas is never blank. */
function sampleMessages(language: AppLanguage): ThreadMessageLike[] {
  return [
    {
      role: "user",
      content: [{ type: "text", text: SAMPLE_CONTEXT }],
      attachments: [
        {
          id: "att-demo",
          type: "image",
          name: "聊天截图 · 示例",
          contentType: "image/jpeg",
          content: [],
          status: { type: "complete" },
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "reasoning",
          text:
            language === "zh"
              ? "已读取 1 张截图与当前文字\n已返回 JSON Schema 结果\nContactFlow Schema 校验通过"
              : "Read 1 image and the current note\nReturned a JSON Schema result\nContactFlow schema validation passed",
        },
        {
          type: "text",
          text:
            language === "zh"
              ? "我找到了几个可以继续推进的动作。"
              : "I found a few actionable next steps.",
        },
      ],
      metadata: { custom: { kind: "actions" } },
    },
  ];
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessionIdSeed = useId();
  const newSessionIndexRef = useRef(0);
  const queueTurnIndexRef = useRef(0);
  const {
    activeSessionId,
    chatIntent,
    consumeChatIntent,
    openDrawer,
    setActiveSessionId,
  } = useAppCanvas();
  const language = useContactFlow((state) => state.language);
  const actions = useContactFlow((state) => state.actions);
  const chatSessions = useContactFlow((state) => state.chatSessions);
  const setActions = useContactFlow((state) => state.setActions);
  const setInsights = useContactFlow((state) => state.setInsights);
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
  const [analysisMeta, setAnalysisMeta] = useState<Omit<
    AgentAnalysis,
    "actions"
  > | null>(() => {
    const state = useContactFlow.getState();
    const session = activeSessionId
      ? state.chatSessions.find((item) => item.id === activeSessionId)
      : undefined;
    if (!session?.analysis) return null;
    return {
      contextSummary: session.analysis.contextSummary,
      notices: session.analysis.notices,
      participantNames: session.analysis.participantNames,
      thinking: session.analysis.thinking ?? "",
    };
  });
  const [insightGenerating, setInsightGenerating] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const queuedTurnsRef = useRef<QueuedTurn[]>([]);
  const [queuedTurns, setQueuedTurns] = useState<QueuedTurn[]>([]);
  const [runningTurn, setRunningTurn] = useState<QueuedTurn | null>(null);
  const queueTurn = (note: string, attachments: ChatAttachment[]) => {
    queueTurnIndexRef.current += 1;
    const item: QueuedTurn = {
      attachments,
      id: `queued-${queueTurnIndexRef.current}`,
      note,
    };
    queuedTurnsRef.current = [...queuedTurnsRef.current, item];
    setQueuedTurns(queuedTurnsRef.current);
  };
  const cancelQueuedTurn = (id: string) => {
    queuedTurnsRef.current = queuedTurnsRef.current.filter(
      (item) => item.id !== id,
    );
    setQueuedTurns(queuedTurnsRef.current);
  };
  const promoteQueuedTurn = (id: string) => {
    const item = queuedTurnsRef.current.find((entry) => entry.id === id);
    if (!item) return;
    queuedTurnsRef.current = [
      item,
      ...queuedTurnsRef.current.filter((entry) => entry.id !== id),
    ];
    setQueuedTurns(queuedTurnsRef.current);
  };
  const analysisModelConfigIdRef = useRef<string | null>(null);
  const lastInsightActionRef = useRef<ActionProposal | null>(null);
  const analysisTurnRef = useRef<ChatTurn | null>(null);
  const analysisSessionRef = useRef<string | null>(null);
  const [modelMenuAnchor, setModelMenuAnchor] =
    useState<ComposerMenuAnchor | null>(null);
  const [permissionMenuAnchor, setPermissionMenuAnchor] =
    useState<ComposerMenuAnchor | null>(null);
  const copy = chatCopy[language];
  const activeModel = resolveModelConfig(modelConfigs, selectedModelConfigId);

  const activeSessionIdRef = useRef(activeSessionId);
  const runtimeRef = useRef<AssistantRuntime | null>(null);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const flushQueuedTurn = useCallback(() => {
    const [next, ...rest] = queuedTurnsRef.current;
    if (!next) return;
    queuedTurnsRef.current = rest;
    setQueuedTurns(rest);
    // Let the runtime finish settling the previous run before starting the next.
    setTimeout(() => {
      runtimeRef.current?.thread.append({
        role: "user",
        content: next.note
          ? [{ type: "text", text: next.note }]
          : [],
        attachments: toMessageAttachments(next.attachments),
        startRun: true,
      });
    }, 60);
  }, []);

  const bridge = useMemo<AnalysisBridge>(
    () => ({
      getContext: () => {
        const state = useContactFlow.getState();
        const sessionId = activeSessionIdRef.current;
        const session = sessionId
          ? state.chatSessions.find((item) => item.id === sessionId)
          : undefined;
        const previous: PreviousAnalysisTurn | null =
          session?.analysis && session.analysis.actions.length > 0
            ? {
                attachments: session.turn.attachments,
                note: session.turn.note,
                proposals: session.analysis.actions.map(
                  (action) =>
                    ({
                      confidence: action.confidence,
                      evidence: action.evidence,
                      payload: action.payload,
                      type: action.type,
                    }) as PreviousAnalysisTurn["proposals"][number],
                ),
              }
            : null;
        return {
          language: state.language,
          memories: state.memories,
          model: resolveModelConfig(
            state.modelConfigs,
            state.selectedModelConfigId,
          ),
          previous,
        };
      },
      onRunStart: (turn) => {
        const state = useContactFlow.getState();
        const modelConfigId = resolveModelConfig(
          state.modelConfigs,
          state.selectedModelConfigId,
        )?.id;
        if (!activeSessionIdRef.current) newSessionIndexRef.current += 1;
        const sessionId =
          activeSessionIdRef.current ??
          `chat-${sessionIdSeed}-${newSessionIndexRef.current}`;
        analysisSessionRef.current = sessionId;
        analysisTurnRef.current = turn;
        setRunningTurn({
          attachments: turn.attachments,
          id: `running-${sessionId}`,
          note: turn.note,
        });
        setActiveSessionId(sessionId);
        saveChatSession({
          id: sessionId,
          title: titleForTurn(turn.note, turn.attachments.length),
          modelConfigId,
          turn,
          updatedAt: new Date().toISOString(),
        });
        setActions([]);
        setAnalysisMeta(null);
        setInsightError(null);
        void Haptics.selectionAsync();
      },
      onRunSuccess: (result, durationMs) => {
        const sessionId = analysisSessionRef.current;
        const turn = analysisTurnRef.current;
        const state = useContactFlow.getState();
        const modelConfigId = resolveModelConfig(
          state.modelConfigs,
          state.selectedModelConfigId,
        )?.id;
        const nextActions = proposalsFromAnalysis(result);
        const meta = {
          contextSummary: result.contextSummary,
          notices: result.notices,
          participantNames: result.participantNames,
          thinking: result.thinking,
        };
        if (sessionId && turn) {
          saveChatSession({
            id: sessionId,
            title: summarizeSessionTitle(
              result.contextSummary,
              turn.note,
              turn.attachments.length,
              state.language,
            ),
            modelConfigId,
            turn,
            updatedAt: new Date().toISOString(),
          });
          updateChatSessionAnalysis(
            sessionId,
            { ...meta, actions: nextActions },
            durationMs,
          );
        }
        setActions(nextActions);
        setAnalysisMeta(meta);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      },
      onRunError: (errorText) => {
        // Persist the failure so switching chats does not lose it.
        const sessionId = analysisSessionRef.current;
        const turn = analysisTurnRef.current;
        if (sessionId && turn) {
          const state = useContactFlow.getState();
          saveChatSession({
            id: sessionId,
            title: titleForTurn(turn.note, turn.attachments.length),
            modelConfigId: resolveModelConfig(
              state.modelConfigs,
              state.selectedModelConfigId,
            )?.id,
            turn,
            analysisError: errorText,
            updatedAt: new Date().toISOString(),
          });
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
      onRunSettled: flushQueuedTurn,
    }),
    [
      flushQueuedTurn,
      saveChatSession,
      sessionIdSeed,
      setActions,
      setActiveSessionId,
      updateChatSessionAnalysis,
    ],
  );

  const adapter = useMemo(() => createAnalysisAdapter(() => bridge), [bridge]);
  const runtime = useLocalRuntime(adapter);
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  // Restore the persisted conversation into the runtime on first mount.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const state = useContactFlow.getState();
    const session = activeSessionId
      ? state.chatSessions.find((item) => item.id === activeSessionId)
      : undefined;
    const modelName =
      resolveModelConfig(state.modelConfigs, state.selectedModelConfigId)
        ?.model ?? "";
    if (session) {
      analysisModelConfigIdRef.current = session.modelConfigId ?? null;
      runtime.thread.reset(
        messagesForSession(session, state.language, modelName),
      );
    } else if (state.actions.length > 0) {
      runtime.thread.reset(sampleMessages(state.language));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNewChat = useCallback(() => {
    runtime.thread.cancelRun();
    queuedTurnsRef.current = [];
    setQueuedTurns([]);
    setRunningTurn(null);
    setActiveSessionId(null);
    setActions([]);
    setAnalysisMeta(null);
    setInsightError(null);
    runtime.thread.reset();
  }, [runtime, setActions, setActiveSessionId]);

  const openSession = useCallback(
    (session: ChatSession) => {
      runtime.thread.cancelRun();
      queuedTurnsRef.current = [];
      setQueuedTurns([]);
      setRunningTurn(null);
      setActiveSessionId(session.id);
      setActions(
        session.analysis?.actions.map(normalizeActionProposal) ?? [],
      );
      setAnalysisMeta(
        session.analysis
          ? {
              contextSummary: session.analysis.contextSummary,
              notices: session.analysis.notices,
              participantNames: session.analysis.participantNames,
              thinking: session.analysis.thinking ?? "",
            }
          : null,
      );
      setInsightError(null);
      analysisModelConfigIdRef.current = session.modelConfigId ?? null;
      if (session.modelConfigId) selectModelConfig(session.modelConfigId);
      const modelName =
        modelConfigs.find((config) => config.id === session.modelConfigId)
          ?.model ??
        resolveModelConfig(
          modelConfigs,
          useContactFlow.getState().selectedModelConfigId,
        )?.model ??
        "";
      runtime.thread.reset(messagesForSession(session, language, modelName));
    },
    [language, modelConfigs, runtime, selectModelConfig, setActions, setActiveSessionId],
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

  const requestInsights = useCallback(
    async (action: ActionProposal) => {
      const currentCopy = chatCopy[language];
      const modelConfig =
        modelConfigs.find(
          (config) => config.id === analysisModelConfigIdRef.current,
        ) ??
        resolveModelConfig(
          modelConfigs,
          useContactFlow.getState().selectedModelConfigId,
        );
      if (!modelConfig) {
        setInsightError(currentCopy.insightModelMissing);
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
        const orderedInsights = [...result.insights].sort(
          (left, right) =>
            Number(left.kind === "suggestion") -
            Number(right.kind === "suggestion"),
        );
        const nextInsights: Insight[] = orderedInsights.map(
          (insight, index) => ({
            ...insight,
            id: `insight-${action.id}-${index}`,
            createdAt,
          }),
        );
        setInsights(nextInsights);
        runtime.thread.append({
          role: "assistant",
          content: [
            {
              type: "reasoning",
              text:
                language === "zh"
                  ? "读取已确认且执行成功的事实\n结合当前上下文生成关系洞察与下一步建议"
                  : "Read confirmed, successfully executed facts\nGenerate an insight and a grounded next step",
            },
            { type: "text", text: currentCopy.insightIntro },
          ],
          metadata: { custom: { kind: "insights", insights: nextInsights } },
          startRun: false,
        });
      } catch (error) {
        setInsightError(
          agentErrorMessage(error, language === "zh" ? "zh-CN" : "en-US"),
        );
      } finally {
        setInsightGenerating(false);
      }
    },
    [analysisMeta, language, modelConfigs, runtime, setInsights],
  );

  const requestInsightsRef = useRef(requestInsights);
  useEffect(() => {
    requestInsightsRef.current = requestInsights;
  }, [requestInsights]);

  const execute = useCallback(
    async (action: ActionProposal) => {
      const currentLanguage = useContactFlow.getState().language;
      const currentCopy = chatCopy[currentLanguage];
      const executableAction = normalizeActionProposal(action);
      if (!isActionValidForExecution(executableAction)) {
        failAction(action.id, currentCopy.invalidAction);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setActionExecuting(action.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const receipt = await executeNativeAction(executableAction);
        completeAction(action.id, receipt);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        await requestInsightsRef.current(executableAction);
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
    },
    [completeAction, failAction, setActionExecuting],
  );
  const retryInsight = useCallback(() => {
    if (lastInsightActionRef.current) {
      void requestInsightsRef.current(lastInsightActionRef.current);
    }
  }, []);

  const chatActionsValue = useMemo(
    () => ({
      executeAction: (action: ActionProposal) => void execute(action),
      retryInsight,
    }),
    [execute, retryInsight],
  );

  const defaultSessionTitle = language === "zh" ? "新对话" : "New conversation";
  const activeSession = activeSessionId
    ? chatSessions.find((session) => session.id === activeSessionId)
    : undefined;
  const currentSessionTitle = activeSession?.title ?? defaultSessionTitle;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatActionsContext.Provider value={chatActionsValue}>
        <View style={styles.root}>
          <SafeAreaView edges={["top"]} style={styles.safeArea}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={8}
              style={styles.keyboardView}
            >
              <ChatHeader
                language={language}
                onOpenChats={openDrawer}
                title={currentSessionTitle}
              />

              <ThreadPrimitive.Messages
                components={threadMessageComponents}
                contentContainerStyle={styles.timeline}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={
                  insightGenerating || insightError ? (
                    <TimelineFooter
                      insightError={insightError}
                      insightGenerating={insightGenerating}
                      language={language}
                      onRetryInsight={retryInsight}
                    />
                  ) : null
                }
                ListHeaderComponent={<TimelineHeader />}
                showsVerticalScrollIndicator={false}
              />

              <View
                style={[
                  styles.composerDock,
                  { paddingBottom: insets.bottom + spacing.sm },
                ]}
              >
                {runningTurn && queuedTurns.length > 0 ? (
                  <View style={styles.queuePanel}>
                    <View style={styles.queueRunningRow}>
                      <View style={styles.queueRunningDot} />
                      <Text numberOfLines={1} style={styles.queueRunningText}>
                        {queueTurnLabel(runningTurn, language)}
                      </Text>
                      <QueueElapsed />
                      <Text style={styles.queueRunningBadge}>
                        {copy.queueRunning}
                      </Text>
                    </View>
                    <Text style={styles.queueCaption}>
                      {copy.queueCaption(queuedTurns.length)}
                    </Text>
                    {queuedTurns.map((item, index) => (
                      <View key={item.id} style={styles.queueItem}>
                        <Text style={styles.queueIndex}>{index + 1}</Text>
                        <Text numberOfLines={1} style={styles.queueItemText}>
                          {queueTurnLabel(item, language)}
                        </Text>
                        {index > 0 ? (
                          <Pressable
                            accessibilityLabel={copy.promoteQueued}
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={() => promoteQueuedTurn(item.id)}
                            style={({ pressed }) => pressed && styles.pressed}
                          >
                            <ArrowUp
                              color={palette.smoke}
                              size={iconSize.small}
                              strokeWidth={2}
                            />
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityLabel={copy.cancelQueued}
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => cancelQueuedTurn(item.id)}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <X
                            color={palette.smoke}
                            size={iconSize.small}
                            strokeWidth={2}
                          />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
                <ChatComposer
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
                  onQueue={queueTurn}
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
      </ChatActionsContext.Provider>
    </AssistantRuntimeProvider>
  );
}

const threadMessageComponents = {
  UserMessage: ChatUserMessage,
  AssistantMessage: ChatAssistantMessage,
};

function TimelineFooter({
  insightError,
  insightGenerating,
  language,
  onRetryInsight,
}: {
  insightError: string | null;
  insightGenerating: boolean;
  language: AppLanguage;
  onRetryInsight: () => void;
}) {
  const copy = chatCopy[language];
  if (insightGenerating) {
    return (
      <View style={styles.agentRow}>
        <View style={styles.agentMarkSpacer} />
        <View style={styles.thinkingRow}>
          <ThinkingDots color={palette.paper as string} />
          <Text style={styles.footerSecondary}>{copy.insightGenerating}</Text>
        </View>
      </View>
    );
  }
  if (insightError) {
    return (
      <View style={styles.agentRow}>
        <View style={styles.agentMarkSpacer} />
        <View style={styles.footerContent}>
          <StatusMessage
            actionLabel={copy.retryInsight}
            message={`${copy.actionSucceededInsightFailed}\n${insightError}`}
            onAction={onRetryInsight}
          />
        </View>
      </View>
    );
  }
  return null;
}

function ChatHeader({
  language,
  onOpenChats,
  title,
}: {
  language: AppLanguage;
  onOpenChats: () => void;
  title: string;
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
        <Text ellipsizeMode="tail" numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]} />
    </View>
  );
}

function titleForTurn(note: string, imageCount: number) {
  const normalized = note.trim().replace(/\s+/g, " ");
  if (normalized) {
    return cleanGeneratedTitle(
      normalized.length > 24 ? `${normalized.slice(0, 24)}…` : normalized,
    );
  }
  return imageCount === 1 ? "图片对话" : `${imageCount} 张图片`;
}

function summarizeSessionTitle(
  contextSummary: string,
  note: string,
  imageCount: number,
  language: AppLanguage,
) {
  const source = contextSummary.trim();
  if (!source) return titleForTurn(note, imageCount);

  const firstSentence = source
    .split(/[。！？!?.；;]/)[0]
    .replace(/[“”"]/g, "")
    .trim();
  const base = firstSentence.length > 0 ? firstSentence : source;
  const maxLength = language === "zh" ? 18 : 22;
  return cleanGeneratedTitle(
    base.length > maxLength ? `${base.slice(0, maxLength)}…` : base,
  );
}

function queueTurnLabel(turn: QueuedTurn, language: AppLanguage) {
  const normalized = turn.note.trim().replace(/\s+/g, " ");
  if (normalized) {
    return normalized.length > 20 ? `${normalized.slice(0, 20)}…` : normalized;
  }
  if (turn.attachments.length === 0) {
    return language === "zh" ? "空输入" : "Empty message";
  }
  return language === "zh"
    ? `${turn.attachments.length} 张图片`
    : `${turn.attachments.length} image${turn.attachments.length > 1 ? "s" : ""}`;
}

/** Small self-ticking elapsed timer for the queue panel's running row. */
function QueueElapsed() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const totalSeconds = Math.max(0, Math.floor((now - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    <Text style={styles.queueElapsed}>
      {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}
    </Text>
  );
}

function cleanGeneratedTitle(value: string) {
  return value.trim().replace(/[。！？!?;；.:：]+$/u, "");
}

const chatCopy = {
  zh: {
    invalidAction: "卡片包含空值或无效时间，请修正后再执行。",
    insightIntro: "基于已确认的信息，我整理了关系洞察和下一步建议：",
    insightGenerating: "正在结合当前上下文与已确认记忆生成洞察和建议…",
    retryInsight: "重试洞察和建议",
    actionSucceededInsightFailed: "系统动作已经成功，但洞察和建议生成失败。",
    insightModelMissing:
      "原分析使用的模型已被删除，暂时无法生成洞察和建议。",
    openChats: "打开聊天记录",
    queueRunning: "队列运行中",
    queueCaption: (count: number) => `待发送 ${count} 条`,
    promoteQueued: "提升到队首",
    cancelQueued: "取消排队",
  },
  en: {
    invalidAction:
      "This card has an empty field or invalid time. Fix it before executing.",
    insightIntro:
      "Based on confirmed information, here is an insight and a next step:",
    insightGenerating:
      "Generating insights and suggestions from confirmed context…",
    retryInsight: "Retry insights and suggestions",
    actionSucceededInsightFailed:
      "The system action succeeded, but insight and suggestion generation failed.",
    insightModelMissing:
      "The model used for this analysis was deleted, so insights and suggestions cannot be generated.",
    openChats: "Open chat history",
    queueRunning: "Queued",
    queueCaption: (count: number) => `${count} item${count === 1 ? "" : "s"} in queue`,
    promoteQueued: "Move to front",
    cancelQueued: "Remove from queue",
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
  agentMarkSpacer: { width: 30 },
  footerContent: { flex: 1 },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  footerSecondary: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
  },
  composerDock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: palette.void,
  },
  queuePanel: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  queueRunningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  queueRunningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  queueElapsed: {
    color: palette.smoke,
    fontFamily: fonts.utility,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  queueRunningText: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  queueRunningBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
    color: palette.void,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    backgroundColor: palette.paper,
  },
  queueCaption: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.graphite,
  },
  queueIndex: {
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: "center",
    textAlignVertical: "center",
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.caption,
    lineHeight: 18,
    backgroundColor: palette.lineSoft,
  },
  queueItemText: {
    flex: 1,
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 20,
  },
  pressed: { opacity: 0.55 },
});
