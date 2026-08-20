import {
  ChainOfThoughtByIndicesProvider,
  ChainOfThoughtPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
  type CompleteAttachment,
  type ReasoningGroupProps,
  type ReasoningMessagePartProps,
} from "@assistant-ui/react-native";
import {
  BrainCircuit,
  ChevronDown,
  CircleAlert,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react-native";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ActionCard } from "@/components/action-card";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { InsightCard } from "@/components/insight-card";
import { Box as View } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  fonts,
  iconSize,
  motion,
  palette,
  radius,
  spacing,
  typeScale,
} from "@/constants/theme";
import type { ActionProposal, Insight } from "@/domain/actions";
import type { AppLanguage } from "@/domain/preferences";
import type { AssistantMessageCustom } from "@/services/analysis-runtime";
import { useContactFlow } from "@/store/use-contactflow";

/** Callbacks the chat screen injects into assistant-ui message components. */
export type ChatActionsContextValue = {
  executeAction: (action: ActionProposal) => void;
  retryInsight: () => void;
};

export const ChatActionsContext = createContext<ChatActionsContextValue>({
  executeAction: () => undefined,
  retryInsight: () => undefined,
});

const messageCopy = {
  zh: {
    welcome: "把聊天截图发我，告诉我你想做什么。",
    welcomeDetail:
      "我来帮你整理人物、时间和承诺，先给你可编辑的行动建议。确认后，我才会写入日历或通讯录。",
    emptyPrompt: "先加张截图，或选一个示例开始",
    actionDetail: "你可以直接修改卡片；点击执行后，我还会再向你确认一次。",
    retryAnalysis: "重新分析",
    retryInsight: "重试洞察和建议",
    demoImage: "示例",
  },
  en: {
    welcome: "Send me chat screenshots and tell me what you want to do.",
    welcomeDetail:
      "I’ll identify people, timing, and commitments, then suggest editable actions. Nothing reaches Calendar or Contacts without your confirmation.",
    emptyPrompt: "Add screenshots below, or start with an example",
    actionDetail:
      "Edit any card first. I’ll ask again before writing to the system.",
    retryAnalysis: "Retry analysis",
    retryInsight: "Retry insights and suggestions",
    demoImage: "Demo",
  },
} as const;

/** Welcome copy rendered above the message list only while the thread is empty. */
export function TimelineHeader() {
  const language = useContactFlow((state) => state.language);
  const hasMessages = useAuiState((state) => state.thread.messages.length > 0);
  const copy = messageCopy[language];

  if (hasMessages) return null;

  return (
    <View style={styles.agentRow}>
      <AgentMark />
      <View style={styles.agentContent}>
        <Text style={styles.agentText}>{copy.welcome}</Text>
        <Text style={styles.agentSecondary}>{copy.welcomeDetail}</Text>
      </View>
    </View>
  );
}

/** User bubble rendered through assistant-ui's message model. */
export function ChatUserMessage() {
  const language = useContactFlow((state) => state.language);
  const attachments = useAuiState((state) =>
    state.message.role === "user" ? state.message.attachments : [],
  );
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        {attachments.length > 0 ? (
          <View style={styles.userAttachments}>
            {attachments.map((attachment) => (
              <UserAttachmentTile
                attachment={attachment}
                key={attachment.id}
                language={language}
                onPreview={setPreviewUri}
              />
            ))}
          </View>
        ) : null}
        <MessagePrimitive.Parts components={{ Text: UserText, Image: HiddenPart, File: HiddenPart }} />
      </View>
      <ImagePreviewModal
        language={language}
        onClose={() => setPreviewUri(null)}
        uri={previewUri}
      />
    </View>
  );
}

function UserAttachmentTile({
  attachment,
  language,
  onPreview,
}: {
  attachment: CompleteAttachment;
  language: AppLanguage;
  onPreview: (uri: string) => void;
}) {
  const imagePart = attachment.content?.find((part) => part.type === "image");
  if (imagePart) {
    return (
      <Pressable
        accessibilityHint={
          language === "zh" ? "打开大图预览" : "Open a full-size preview"
        }
        accessibilityLabel={attachment.name}
        accessibilityRole="button"
        onPress={() => onPreview(imagePart.image)}
        style={({ pressed }) => pressed && styles.thumbnailPressed}
      >
        <Image source={{ uri: imagePart.image }} style={styles.userImage} />
      </Pressable>
    );
  }
  return (
    <View style={styles.userImagePlaceholder}>
      <ImageIcon
        color={palette.void}
        size={iconSize.medium}
        strokeWidth={1.7}
      />
      <Text style={styles.userImageLabel}>{messageCopy[language].demoImage}</Text>
    </View>
  );
}

function UserText({ text }: { text: string }) {
  if (!text.trim()) return null;
  return <Text style={styles.userText}>{text}</Text>;
}

/** Attachments render as tiles above the text; the raw parts stay hidden. */
function HiddenPart() {
  return null;
}

/** Assistant message: chain-of-thought parts plus action/insight/error extras. */
export function ChatAssistantMessage() {
  return (
    <View style={styles.agentRow}>
      <AgentMark />
      <View style={styles.agentContent}>
        <MessagePrimitive.Parts
          components={{
            Text: AssistantText,
            Reasoning: ReasoningSteps,
            ReasoningGroup: ChatReasoningGroup,
          }}
        />
        <AssistantExtras />
      </View>
    </View>
  );
}

function AssistantExtras() {
  const { executeAction, retryInsight } = useContext(ChatActionsContext);
  const language = useContactFlow((state) => state.language);
  const actions = useContactFlow((state) => state.actions);
  const permissionMode = useContactFlow((state) => state.permissionMode);
  const updateActionPayload = useContactFlow(
    (state) => state.updateActionPayload,
  );
  const aui = useAui();
  const custom = useAuiState((state) =>
    state.message.role === "assistant"
      ? (state.message.metadata.custom as AssistantMessageCustom | undefined)
      : undefined,
  );
  const isLast = useAuiState((state) => state.message.isLast);
  const isLastActionsMessage = useAuiState((state) => {
    const messages = state.thread.messages;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const candidate = messages[index];
      if (
        candidate.role === "assistant" &&
        (candidate.metadata.custom as AssistantMessageCustom | undefined)
          ?.kind === "actions"
      ) {
        return candidate.id === state.message.id;
      }
    }
    return false;
  });
  const retryParentId = useAuiState((state) => {
    const messages = state.thread.messages;
    const index = messages.findIndex(
      (message) => message.id === state.message.id,
    );
    return index > 0 ? messages[index - 1].id : null;
  });
  const copy = messageCopy[language];

  if (custom?.kind === "error" && custom.errorText) {
    return (
      <StatusMessage
        actionLabel={isLast ? copy.retryAnalysis : undefined}
        message={custom.errorText}
        onAction={
          isLast && retryParentId
            ? () => aui.thread.startRun({ parentId: retryParentId })
            : undefined
        }
      />
    );
  }

  if (custom?.kind === "insight-error" && custom.errorText) {
    return (
      <StatusMessage
        actionLabel={isLast ? copy.retryInsight : undefined}
        message={custom.errorText}
        onAction={isLast ? retryInsight : undefined}
      />
    );
  }

  if (custom?.kind === "insights") {
    const insights = (custom.insights ?? []) as Insight[];
    if (insights.length === 0) return null;
    return (
      <View style={styles.actionList}>
        {insights.map((insight) => (
          <InsightCard
            insight={insight}
            key={insight.id}
            language={language}
          />
        ))}
      </View>
    );
  }

  if (custom?.kind === "actions" && isLastActionsMessage && actions.length > 0) {
    return (
      <>
        <Text style={styles.agentSecondary}>{copy.actionDetail}</Text>
        <View style={styles.actionList}>
          {actions.map((action) => (
            <ActionCard
              accent={palette.accent}
              action={action}
              key={action.id}
              language={language}
              onChange={(patch) => updateActionPayload(action.id, patch)}
              onExecute={() => executeAction(action)}
              permissionMode={permissionMode}
            />
          ))}
        </View>
      </>
    );
  }

  return null;
}

function AssistantText({ text }: { text: string }) {
  return (
    <Text className="text-[16px] leading-[24px]" style={styles.assistantText}>
      {text}
    </Text>
  );
}

function ChatReasoningGroup({
  children,
  endIndex,
  startIndex,
}: ReasoningGroupProps) {
  return (
    <ChainOfThoughtByIndicesProvider endIndex={endIndex} startIndex={startIndex}>
      <ReasoningSummary>{children}</ReasoningSummary>
    </ChainOfThoughtByIndicesProvider>
  );
}

/** Ticks locally so the rest of the chat tree is not re-rendered. */
function RunningElapsed({ language }: { language: AppLanguage }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, now - start) / 1000;
  return (
    <>
      {language === "zh" ? "正在分析" : "Analyzing"} · {seconds.toFixed(1)}s
    </>
  );
}

function ReasoningSummary({ children }: { children: ReactNode }) {
  const language = useContactFlow((state) => state.language);
  const collapsed = useAuiState((state) => state.chainOfThought.collapsed);
  const running = useAuiState((state) =>
    state.message.role === "assistant"
      ? state.message.status.type === "running"
      : false,
  );
  const elapsedMs = useAuiState((state) =>
    state.message.role === "assistant"
      ? (state.message.metadata.custom as AssistantMessageCustom | undefined)
          ?.elapsedMs
      : undefined,
  );
  const aui = useAui();
  const chevronRotation = useSharedValue(collapsed ? 0 : 180);

  useEffect(() => {
    chevronRotation.value = withTiming(collapsed ? 0 : 180, {
      duration: motion.fast,
      easing: Easing.out(Easing.cubic),
    });
  }, [chevronRotation, collapsed]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  useEffect(() => {
    aui.chainOfThought.setCollapsed(!running);
  }, [aui, running]);

  const elapsedLabel =
    elapsedMs === undefined ? null : `${(elapsedMs / 1000).toFixed(1)}s`;
  const title: ReactNode = running ? (
    <RunningElapsed language={language} />
  ) : elapsedLabel ? (
    language === "zh" ? (
      `思考 ${elapsedLabel}`
    ) : (
      `Thought for ${elapsedLabel}`
    )
  ) : language === "zh" ? (
    "分析摘要"
  ) : (
    "Analysis summary"
  );

  return (
    <Animated.View
      layout={LinearTransition.duration(motion.standard)
        .easing(Easing.out(Easing.cubic))
        .reduceMotion(ReduceMotion.System)}
    >
      <ChainOfThoughtPrimitive.Root
        className="mb-3 overflow-hidden rounded-2xl border"
        style={styles.reasoningRoot}
      >
        <ChainOfThoughtPrimitive.AccordionTrigger
          accessibilityLabel={
            language === "zh"
              ? "展开或收起分析摘要"
              : "Expand or collapse analysis summary"
          }
        >
          <HStack className="min-h-11 items-center gap-2 px-3">
            <BrainCircuit
              color={palette.mist}
              size={iconSize.small}
              strokeWidth={1.6}
            />
            <Text className="flex-1 text-xs" style={styles.reasoningTitle}>
              {title}
            </Text>
            <Animated.View style={chevronStyle}>
              <ChevronDown
                color={palette.smoke}
                size={iconSize.small}
                strokeWidth={1.6}
              />
            </Animated.View>
          </HStack>
        </ChainOfThoughtPrimitive.AccordionTrigger>
        {!collapsed ? (
          <VStack
            className="gap-2 border-t px-3 py-3"
            style={styles.reasoningBody}
          >
            {children}
          </VStack>
        ) : null}
      </ChainOfThoughtPrimitive.Root>
    </Animated.View>
  );
}

function ReasoningSteps({ text }: ReasoningMessagePartProps) {
  const running = useAuiState((state) =>
    state.message.role === "assistant"
      ? state.message.status.type === "running"
      : false,
  );
  // While running this is the model's live thinking narrative; once settled it
  // becomes the step summary, so bullets only apply to the finished form.
  if (running) {
    return (
      <Text className="flex-1 text-xs leading-[18px]" style={styles.step}>
        {text}
      </Text>
    );
  }
  return (
    <>
      {text
        .split("\n")
        .filter(Boolean)
        .map((step, index) => (
          <HStack className="items-start gap-2" key={`${step}-${index}`}>
            <View
              className="mt-[7px] h-1 w-1 rounded-full"
              style={styles.bullet}
            />
            <Text className="flex-1 text-xs leading-[18px]" style={styles.step}>
              {step}
            </Text>
          </HStack>
        ))}
    </>
  );
}

function AgentMark() {
  return (
    <View style={styles.agentMark}>
      <View style={styles.agentOrbit} />
      <View style={styles.agentCore} />
    </View>
  );
}

export function StatusMessage({
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
        <Text style={styles.agentSecondaryNoMargin}>{message}</Text>
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

const styles = StyleSheet.create({
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
  agentSecondaryNoMargin: {
    color: palette.mist,
    fontFamily: fonts.body,
    fontSize: typeScale.label,
    lineHeight: 21,
  },
  assistantText: {
    color: palette.paper,
    fontFamily: fonts.bodyMedium,
  },
  reasoningRoot: {
    overflow: "hidden",
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.lineSoft,
    backgroundColor: palette.graphite,
  },
  reasoningTitle: {
    color: palette.mist,
    fontFamily: fonts.bodyMedium,
  },
  reasoningBody: { borderColor: palette.line },
  bullet: { backgroundColor: palette.smoke },
  step: { color: palette.smoke, fontFamily: fonts.body },
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
  thumbnailPressed: { opacity: 0.78 },
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
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
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
  actionList: { gap: spacing.md, marginTop: spacing.lg },
  pressed: { opacity: 0.55 },
});
