import type {
  ChatModelAdapter,
  ChatModelRunResult,
  ThreadMessage,
} from "@assistant-ui/react-native";

import type { AnalysisResult, MemoryFact } from "@/domain/actions";
import type { ChatAttachment, ChatTurn } from "@/domain/chat";
import type { ModelConfig } from "@/domain/model-config";
import type { AppLanguage } from "@/domain/preferences";
import {
  AgentRequestError,
  agentErrorMessage,
  analyzeContext,
  type AnalysisProgressStage,
  type PreviousAnalysisTurn,
} from "@/services/openai-compatible-agent";

/** Metadata tags attached to assistant messages so the timeline can render extras. */
export type AssistantMessageKind =
  | "actions"
  | "error"
  | "insight-error"
  | "insights";

export type AssistantMessageCustom = {
  elapsedMs?: number;
  errorText?: string;
  insights?: unknown;
  kind?: AssistantMessageKind;
};

export type AnalysisBridge = {
  getContext(): {
    language: AppLanguage;
    memories: MemoryFact[];
    model: ModelConfig | null;
    previous: PreviousAnalysisTurn | null;
  };
  onRunError(errorText: string): void;
  onRunSettled(): void;
  onRunStart(turn: ChatTurn): void;
  onRunSuccess(result: AnalysisResult, durationMs: number): void;
};

/** One-line pipeline status shown inside the chain-of-thought card. */
export function analysisSteps(
  stage: AnalysisProgressStage,
  {
    attachmentCount,
    language,
    modelName,
  }: {
    attachmentCount: number;
    language: AppLanguage;
    modelName: string;
  },
) {
  const imageCount =
    language === "zh"
      ? `${attachmentCount} 张截图`
      : `${attachmentCount} image${attachmentCount === 1 ? "" : "s"}`;
  if (stage === "preparing_input") {
    return language === "zh"
      ? `读取文字与${imageCount}，压缩图片并移除原始元数据`
      : `Reading text and ${imageCount}, compressing images and stripping metadata`;
  }
  if (stage === "requesting_model") {
    return language === "zh"
      ? `正在请求 ${modelName} 返回结构化动作`
      : `Asking ${modelName} for structured actions`;
  }
  return language === "zh"
    ? "正在用 ContactFlow Schema 校验证据与必填字段"
    : "Validating evidence and required fields with the ContactFlow schema";
}

/** Static reasoning summary rendered once an analysis run completes. */
export function resultReasoning({
  attachmentCount,
  language,
  modelName,
  result,
}: {
  attachmentCount: number;
  language: AppLanguage;
  modelName: string;
  result: Pick<AnalysisResult, "contextSummary" | "notices">;
}) {
  const lines = [
    language === "zh"
      ? `已读取 ${attachmentCount} 张截图与当前文字`
      : `Read ${attachmentCount} image${attachmentCount === 1 ? "" : "s"} and the current note`,
    language === "zh"
      ? `${modelName} 已返回 JSON Schema 结果`
      : `${modelName} returned a JSON Schema result`,
    language === "zh"
      ? "ContactFlow Schema 校验通过"
      : "ContactFlow schema validation passed",
    result.contextSummary,
    ...result.notices.map((notice) => notice.message),
  ];
  return lines.filter(Boolean).join("\n");
}

export function resultText({
  actionCount,
  language,
  notices,
}: {
  actionCount: number;
  language: AppLanguage;
  notices: { message: string }[];
}) {
  if (actionCount > 0) {
    return language === "zh"
      ? `我找到了 ${actionCount} 个可以继续推进的动作。`
      : `I found ${actionCount} actionable next step${actionCount === 1 ? "" : "s"}.`;
  }
  return (
    notices.map((notice) => notice.message).join("\n") ||
    (language === "zh"
      ? "没有找到证据充分、可以安全执行的动作。"
      : "I found no evidence-backed action that is safe to execute.")
  );
}

/** Reads the note and image attachments the runtime collected on the user message. */
export function turnFromUserMessage(message: ThreadMessage | undefined): ChatTurn {
  if (!message || message.role !== "user") return { note: "", attachments: [] };
  const note = message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  const seen = new Set<string>();
  const attachments: ChatAttachment[] = [];
  const pushAttachment = (label: string, uri: string | undefined) => {
    const key = uri ?? `label:${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    attachments.push({ isDemo: !uri, label, uri });
  };
  for (const attachment of message.attachments ?? []) {
    const imagePart = attachment.content?.find((part) => part.type === "image");
    pushAttachment(attachment.name, imagePart?.image);
  }
  for (const part of message.content) {
    if (part.type === "image") pushAttachment("image", part.image);
  }
  return { note, attachments };
}

/** Minimal async channel used to interleave progress callbacks with generator yields. */
type StreamEvent =
  | { kind: "stage"; stage: AnalysisProgressStage }
  | { kind: "thinking"; text: string };

function createEventChannel() {
  const buffered: (StreamEvent | null)[] = [];
  const waiters: ((value: StreamEvent | null) => void)[] = [];
  return {
    push(value: StreamEvent | null) {
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else buffered.push(value);
    },
    next(): Promise<StreamEvent | null> {
      const bufferedValue = buffered.shift();
      if (bufferedValue !== undefined) return Promise.resolve(bufferedValue);
      return new Promise((resolve) => waiters.push(resolve));
    },
  };
}

/**
 * ChatModelAdapter that runs the ContactFlow analysis pipeline inside the
 * assistant-ui runtime: reasoning steps stream into the running message, so
 * the thinking card updates in place instead of remounting.
 */
export function createAnalysisAdapter(
  getBridge: () => AnalysisBridge,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const bridge = getBridge();
      const { language, memories, model, previous } = bridge.getContext();
      const locale = language === "zh" ? "zh-CN" : "en-US";
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const turn = turnFromUserMessage(lastUser);
      const startedAt = Date.now();
      const modelName = model?.model ?? (language === "zh" ? "所选模型" : "the selected model");
      const stepsOptions = {
        attachmentCount: turn.attachments.length,
        language,
        modelName,
      };
      let lastStage: AnalysisProgressStage = "preparing_input";

      bridge.onRunStart(turn);

      try {
        if (!model) {
          const errorText =
            language === "zh"
              ? "还没有可用模型，请先在模型设置中添加并选择一个模型。"
              : "No model is configured. Add and select one in model settings.";
          bridge.onRunError(errorText);
          yield errorRunResult(analysisSteps(lastStage, stepsOptions), errorText);
          return;
        }

        // Stage lines appear instantly; the model's own thinking replaces them
        // as soon as it starts streaming.
        const processLines: string[] = [];
        let thinkingText = "";
        const currentReasoning = () =>
          thinkingText.trim() ||
          [...processLines, analysisSteps(lastStage, stepsOptions)].join("\n");
        yield reasoningUpdate(analysisSteps(lastStage, stepsOptions));

        const channel = createEventChannel();
        const outcome: { error?: unknown; result?: AnalysisResult } = {};
        const request = analyzeContext({
          attachments: turn.attachments,
          config: model,
          locale,
          memories,
          note: turn.note,
          now: new Date(),
          onProgress: (stage) => channel.push({ kind: "stage", stage }),
          onThinking: (text) => channel.push({ kind: "thinking", text }),
          previous,
          signal: abortSignal,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        request.then(
          (result) => {
            outcome.result = result;
            channel.push(null);
          },
          (error) => {
            outcome.error = error;
            channel.push(null);
          },
        );

        for (;;) {
          const event = await channel.next();
          if (event === null) break;
          if (event.kind === "stage") {
            processLines.push(analysisSteps(lastStage, stepsOptions));
            lastStage = event.stage;
          } else {
            thinkingText = event.text;
          }
          yield reasoningUpdate(currentReasoning());
        }

        const durationMs = Date.now() - startedAt;

        if (outcome.error) {
          const cancelled =
            outcome.error instanceof AgentRequestError &&
            outcome.error.code === "CANCELLED";
          if (cancelled) {
            yield {
              content: [
                { type: "reasoning", text: currentReasoning() },
                {
                  type: "text",
                  text: language === "zh" ? "已停止分析。" : "Analysis stopped.",
                },
              ],
              status: { type: "incomplete", reason: "cancelled" },
            };
            return;
          }
          const errorText = agentErrorMessage(outcome.error, locale);
          bridge.onRunError(errorText);
          yield errorRunResult(currentReasoning(), errorText);
          return;
        }

        const result = outcome.result;
        if (!result) {
          yield errorRunResult(
            analysisSteps(lastStage, stepsOptions),
            language === "zh" ? "分析中断，请重试。" : "Analysis was interrupted. Please retry.",
          );
          return;
        }

        bridge.onRunSuccess(result, durationMs);
        yield {
          content: [
            {
              type: "reasoning",
              text: resultReasoning({ ...stepsOptions, result }),
            },
            {
              type: "text",
              text: resultText({
                actionCount: result.proposals.length,
                language,
                notices: result.notices,
              }),
            },
          ],
          metadata: {
            custom: {
              elapsedMs: durationMs,
              kind: result.proposals.length > 0 ? "actions" : undefined,
            } satisfies AssistantMessageCustom,
          },
        };
        return;
      } finally {
        bridge.onRunSettled();
      }
    },
  };
}

function reasoningUpdate(text: string): ChatModelRunResult {
  return { content: [{ type: "reasoning", text }] };
}

function errorRunResult(reasoning: string, errorText: string): ChatModelRunResult {
  return {
    content: [{ type: "reasoning", text: reasoning }],
    status: { type: "incomplete", reason: "error", error: errorText },
    metadata: {
      custom: { errorText, kind: "error" } satisfies AssistantMessageCustom,
    },
  };
}
