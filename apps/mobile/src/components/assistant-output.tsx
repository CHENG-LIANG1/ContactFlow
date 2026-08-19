import {
  AssistantRuntimeProvider,
  ChainOfThoughtByIndicesProvider,
  ChainOfThoughtPrimitive,
  type ChatModelAdapter,
  MessageByIndexProvider,
  MessagePrimitive,
  type ReasoningGroupProps,
  type ReasoningMessagePartProps,
  type ThreadMessageLike,
  useAui,
  useAuiState,
  useLocalRuntime,
} from "@assistant-ui/react-native";
import { BrainCircuit, ChevronDown } from "lucide-react-native";
import { type ReactNode, useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  fonts,
  iconSize,
  motion,
  palette,
  radius,
  spacing,
} from "@/constants/theme";
import type { AppLanguage } from "@/domain/preferences";

const localDisplayAdapter: ChatModelAdapter = {
  async run() {
    return { content: [] };
  },
};

type AssistantOutputProps = {
  children?: ReactNode;
  defaultExpanded?: boolean;
  elapsedMs?: number;
  language: AppLanguage;
  message?: string;
  reasoning: string;
  running?: boolean;
};

/** Keeps locally generated demo output on assistant-ui's native message model. */
export function AssistantOutput({
  children,
  defaultExpanded = false,
  elapsedMs,
  language,
  message,
  reasoning,
  running = false,
}: AssistantOutputProps) {
  const initialMessages = useMemo<ThreadMessageLike[]>(
    () => [
      {
        role: "assistant",
        content: [
          {
            type: "reasoning",
            text: reasoning,
            unstable_summary:
              language === "zh"
                ? "已完成上下文分析"
                : "Context analysis complete",
          },
          ...(message ? ([{ type: "text", text: message }] as const) : []),
        ],
      },
    ],
    [language, message, reasoning],
  );
  const runtime = useLocalRuntime(localDisplayAdapter, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantMessageSlot
        defaultExpanded={defaultExpanded}
        elapsedMs={elapsedMs}
        language={language}
        running={running}
      >
        {children}
      </AssistantMessageSlot>
    </AssistantRuntimeProvider>
  );
}

function AssistantMessageSlot({
  children,
  defaultExpanded,
  elapsedMs,
  language,
  running,
}: {
  children?: ReactNode;
  defaultExpanded: boolean;
  elapsedMs?: number;
  language: AppLanguage;
  running: boolean;
}) {
  const messageCount = useAuiState((state) => state.thread.messages.length);
  if (messageCount === 0) return null;

  return (
    <MessageByIndexProvider index={0}>
      <MessagePrimitive.Root>
        <MessagePrimitive.Parts
          components={{
            Text: AssistantText,
            Reasoning: ReasoningSteps,
            ReasoningGroup: (props) => (
              <ReasoningGroup
                defaultExpanded={defaultExpanded}
                elapsedMs={elapsedMs}
                language={language}
                running={running}
                {...props}
              />
            ),
          }}
        />
        {children}
      </MessagePrimitive.Root>
    </MessageByIndexProvider>
  );
}

function AssistantText({ text }: { text: string }) {
  return (
    <Text className="text-[16px] leading-[24px]" style={styles.assistantText}>
      {text}
    </Text>
  );
}

function ReasoningGroup({
  children,
  defaultExpanded,
  elapsedMs,
  endIndex,
  language,
  running,
  startIndex,
}: ReasoningGroupProps & {
  defaultExpanded: boolean;
  elapsedMs?: number;
  language: AppLanguage;
  running: boolean;
}) {
  return (
    <ChainOfThoughtByIndicesProvider
      endIndex={endIndex}
      startIndex={startIndex}
    >
      <ReasoningSummary
        defaultExpanded={defaultExpanded}
        elapsedMs={elapsedMs}
        language={language}
        running={running}
      >
        {children}
      </ReasoningSummary>
    </ChainOfThoughtByIndicesProvider>
  );
}

function ReasoningSummary({
  children,
  defaultExpanded,
  elapsedMs,
  language,
  running,
}: {
  children: ReactNode;
  defaultExpanded: boolean;
  elapsedMs?: number;
  language: AppLanguage;
  running: boolean;
}) {
  const collapsed = useAuiState((state) => state.chainOfThought.collapsed);
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
    if (defaultExpanded) aui.chainOfThought.setCollapsed(false);
  }, [aui, defaultExpanded]);

  const elapsedLabel =
    elapsedMs === undefined ? null : `${(elapsedMs / 1000).toFixed(1)}s`;
  const title = running
    ? language === "zh"
      ? `正在分析 · ${elapsedLabel}`
      : `Analyzing · ${elapsedLabel}`
    : elapsedLabel
      ? language === "zh"
        ? `思考 ${elapsedLabel}`
        : `Thought for ${elapsedLabel}`
      : language === "zh"
        ? "分析摘要"
        : "Analysis summary";

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
          <Animated.View
            entering={FadeIn.duration(motion.standard).reduceMotion(
              ReduceMotion.System,
            )}
            exiting={FadeOut.duration(motion.fast).reduceMotion(
              ReduceMotion.System,
            )}
          >
            <VStack
              className="gap-2 border-t px-3 py-3"
              style={styles.reasoningBody}
            >
              {children}
            </VStack>
          </Animated.View>
        ) : null}
      </ChainOfThoughtPrimitive.Root>
    </Animated.View>
  );
}

function ReasoningSteps({ text }: ReasoningMessagePartProps) {
  return (
    <>
      {text
        .split("\n")
        .filter(Boolean)
        .map((step, index) => (
          <HStack className="items-start gap-2" key={`${step}-${index}`}>
            <Box
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

const styles = StyleSheet.create({
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
});
