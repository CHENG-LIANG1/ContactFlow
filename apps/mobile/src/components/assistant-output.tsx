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
  useAuiState,
  useLocalRuntime,
} from "@assistant-ui/react-native";
import { BrainCircuit, ChevronDown } from "lucide-react-native";
import { type ReactNode, useMemo } from "react";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { palette } from "@/constants/theme";
import type { AppLanguage } from "@/domain/preferences";

const localDisplayAdapter: ChatModelAdapter = {
  async run() {
    return { content: [] };
  },
};

type AssistantOutputProps = {
  children?: ReactNode;
  language: AppLanguage;
  message: string;
  reasoning: string;
};

/** Keeps locally generated demo output on assistant-ui's native message model. */
export function AssistantOutput({
  children,
  language,
  message,
  reasoning,
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
              language === "zh" ? "已完成上下文分析" : "Context analysis complete",
          },
          { type: "text", text: message },
        ],
      },
    ],
    [language, message, reasoning],
  );
  const runtime = useLocalRuntime(localDisplayAdapter, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantMessageSlot language={language}>{children}</AssistantMessageSlot>
    </AssistantRuntimeProvider>
  );
}

function AssistantMessageSlot({
  children,
  language,
}: {
  children?: ReactNode;
  language: AppLanguage;
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
              <ReasoningGroup language={language} {...props} />
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
    <Text className="font-medium text-[15px] leading-[22px] text-[#f7f6ee]">
      {text}
    </Text>
  );
}

function ReasoningGroup({
  children,
  endIndex,
  language,
  startIndex,
}: ReasoningGroupProps & { language: AppLanguage }) {
  return (
    <ChainOfThoughtByIndicesProvider
      endIndex={endIndex}
      startIndex={startIndex}
    >
      <ReasoningSummary language={language}>{children}</ReasoningSummary>
    </ChainOfThoughtByIndicesProvider>
  );
}

function ReasoningSummary({
  children,
  language,
}: {
  children: ReactNode;
  language: AppLanguage;
}) {
  const collapsed = useAuiState((state) => state.chainOfThought.collapsed);

  return (
    <ChainOfThoughtPrimitive.Root className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
      <ChainOfThoughtPrimitive.AccordionTrigger
        accessibilityLabel={
          language === "zh" ? "展开或收起分析摘要" : "Expand or collapse analysis summary"
        }
      >
        <HStack className="min-h-11 items-center gap-2 px-3">
          <BrainCircuit color={palette.mist} size={15} strokeWidth={1.6} />
          <Text className="flex-1 font-medium text-xs text-[#c9c8c0]">
            {language === "zh" ? "分析摘要" : "Analysis summary"}
          </Text>
          <ChevronDown
            color={palette.smoke}
            size={15}
            strokeWidth={1.6}
            style={{ transform: [{ rotate: collapsed ? "0deg" : "180deg" }] }}
          />
        </HStack>
      </ChainOfThoughtPrimitive.AccordionTrigger>
      {!collapsed ? (
        <VStack className="gap-2 border-t border-white/10 px-3 py-3">
          {children}
          <Text className="pt-1 text-[10px] leading-[15px] text-[#777872]">
            {language === "zh"
              ? "这里展示的是可核验的处理摘要，不是模型的隐藏推理。"
              : "This is a reviewable process summary, not hidden model reasoning."}
          </Text>
        </VStack>
      ) : null}
    </ChainOfThoughtPrimitive.Root>
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
            <Box className="mt-[7px] h-1 w-1 rounded-full bg-[#aaa9a2]" />
            <Text className="flex-1 text-xs leading-[18px] text-[#aaa9a2]">
              {step}
            </Text>
          </HStack>
        ))}
    </>
  );
}
