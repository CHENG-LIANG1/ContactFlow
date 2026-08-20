import { z } from "zod";

import {
  actionContactName,
  AnalysisResultSchema,
  InsightResultSchema,
  type ActionProposal,
  type AnalysisResult,
  type InsightResult,
  type MemoryFact,
  type ModelActionDraft,
} from "@/domain/actions";
import type { ChatAttachment } from "@/domain/chat";
import {
  isChatCompletionsProvider,
  type ModelConfig,
} from "@/domain/model-config";
import { prepareImageDataUrl } from "@/services/image-input";
import { readModelApiKey } from "@/services/model-secrets";

const MAX_REQUEST_BYTES = 1_850_000;
const REQUEST_TIMEOUT_MS = 60_000;

type FetchLike = typeof fetch;
type UserContent =
  | string
  | (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[];

export type AgentErrorCode =
  | "UNSUPPORTED_PROVIDER"
  | "MISSING_API_KEY"
  | "INVALID_CONFIG"
  | "IMAGE_TOO_LARGE"
  | "AUTHENTICATION"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK"
  | "MODEL_REJECTED"
  | "INVALID_RESPONSE"
  | "CANCELLED";

export class AgentRequestError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AgentRequestError";
  }
}

export type PreviousAnalysisTurn = {
  attachments: ChatAttachment[];
  note: string;
  proposals: ModelActionDraft[];
};

export type AnalyzeContextInput = {
  attachments: ChatAttachment[];
  config: ModelConfig;
  locale: string;
  memories: MemoryFact[];
  note: string;
  now: Date;
  /** Streams the model's in-progress `thinking` narrative as it is written. */
  onThinking?: (text: string) => void;
  onProgress?: (stage: AnalysisProgressStage) => void;
  /** Earlier turn in the same conversation, so follow-ups update in place. */
  previous?: PreviousAnalysisTurn | null;
  signal?: AbortSignal;
  timeZone: string;
};

export type AnalysisProgressStage =
  | "preparing_input"
  | "requesting_model"
  | "validating_schema";

export type GenerateInsightsInput = {
  action: ActionProposal;
  config: ModelConfig;
  contextSummary: string;
  locale: string;
  memories: MemoryFact[];
};

type StructuredRequestInput<T> = {
  apiKey: string;
  config: ModelConfig;
  fetchImpl?: FetchLike;
  jsonSchemaName: string;
  maxAttempts?: number;
  onResponse?: () => void;
  /** Receives the model's partially-written `thinking` text while streaming. */
  onStreamText?: (text: string) => void;
  retryDelayMs?: number;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  systemPrompt: string;
  userContent: UserContent;
};

type StreamingFetchLike = (
  url: string,
  init: {
    body: string;
    headers: Record<string, string>;
    method: "POST";
    signal: AbortSignal;
  },
) => Promise<{
  body: ReadableStream<Uint8Array> | null;
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

let cachedExpoFetch: StreamingFetchLike | null = null;

/** expo/fetch exposes a real streaming body; loaded lazily so tests stay native-free. */
function streamingFetch(): StreamingFetchLike {
  if (!cachedExpoFetch) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedExpoFetch = require("expo/fetch").fetch as StreamingFetchLike;
  }
  return cachedExpoFetch;
}

/** Reads the in-progress string value of `"thinking"` from a partial JSON payload. */
export function extractPartialThinking(json: string) {
  const keyIndex = json.indexOf('"thinking"');
  if (keyIndex < 0) return "";
  const quoteIndex = json.indexOf('"', json.indexOf(":", keyIndex));
  if (quoteIndex < 0) return "";
  let raw = json.slice(quoteIndex + 1);
  // If the value already closed, cut everything after its closing quote.
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== '"') continue;
    let backslashes = 0;
    for (let cursor = index - 1; raw[cursor] === "\\"; cursor -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) {
      raw = raw.slice(0, index);
      break;
    }
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return JSON.parse(`"${raw}"`) as string;
    } catch {
      raw = raw.slice(0, -1);
      if (!raw) return "";
    }
  }
  return "";
}

async function readStreamingBody(
  response: { body: ReadableStream<Uint8Array> | null },
  onText: (accumulated: string) => void,
) {
  if (!response.body) {
    throw new AgentRequestError(
      "INVALID_RESPONSE",
      "The model response did not stream a body.",
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onText(accumulated);
        }
      } catch {
        // Ignore keep-alive or partial frames.
      }
    }
  }
  return accumulated;
}

/** Single streaming attempt; callers fall back to the classic request on failure. */
async function streamStructuredOutput<T>({
  apiKey,
  body,
  config,
  onStreamText,
  schema,
  signal,
  fetchImpl,
}: {
  apiKey: string;
  body: string;
  config: ModelConfig;
  fetchImpl?: StreamingFetchLike;
  onStreamText: (text: string) => void;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
}): Promise<T> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort);
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await (fetchImpl ?? streamingFetch())(
      endpointFor(config.baseUrl),
      {
        body,
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      let providerMessage: string | undefined;
      try {
        providerMessage = (
          JSON.parse(errorText) as { error?: { message?: string } }
        ).error?.message;
      } catch {
        providerMessage = undefined;
      }
      throw errorForStatus(response.status, providerMessage);
    }
    let lastThinking = "";
    const content = await readStreamingBody(response, (accumulated) => {
      const thinking = extractPartialThinking(accumulated);
      if (thinking && thinking !== lastThinking) {
        lastThinking = thinking;
        onStreamText(thinking);
      }
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AgentRequestError(
        "INVALID_RESPONSE",
        "The model output was not valid JSON.",
      );
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new AgentRequestError(
        "INVALID_RESPONSE",
        "The model output did not match the ContactFlow schema.",
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof AgentRequestError) throw error;
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || controller.signal.aborted);
    if (aborted) {
      if (signal?.aborted) {
        throw new AgentRequestError("CANCELLED", "The request was stopped.");
      }
      throw new AgentRequestError("TIMEOUT", "The model request timed out.");
    }
    throw new AgentRequestError(
      "NETWORK",
      "Could not reach the model service.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }
}


function endpointFor(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new AgentRequestError(
      "INVALID_CONFIG",
      "Model Base URL is invalid.",
    );
  }
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function errorForStatus(status: number, providerMessage?: string) {
  if (status === 401 || status === 403) {
    return new AgentRequestError(
      "AUTHENTICATION",
      "The model rejected this API key or model access.",
      status,
    );
  }
  if (status === 429) {
    return new AgentRequestError(
      "RATE_LIMITED",
      "The model service is rate limited. Try again shortly.",
      status,
    );
  }
  return new AgentRequestError(
    "NETWORK",
    providerMessage
      ? `Model request failed (${status}): ${providerMessage}`
      : `Model request failed (${status}).`,
    status,
  );
}

async function pause(duration: number) {
  await new Promise((resolve) => setTimeout(resolve, duration));
}

/** A strict Chat Completions call: schema failures never fall back to free text. */
export async function requestStructuredOutput<T>({
  apiKey,
  config,
  fetchImpl = fetch,
  jsonSchemaName,
  maxAttempts = 2,
  onResponse,
  onStreamText,
  retryDelayMs = 400,
  schema,
  signal,
  systemPrompt,
  userContent,
}: StructuredRequestInput<T>): Promise<T> {
  if (!isChatCompletionsProvider(config.provider)) {
    throw new AgentRequestError(
      "UNSUPPORTED_PROVIDER",
      "This provider protocol is not connected yet.",
    );
  }
  if (!apiKey.trim()) {
    throw new AgentRequestError(
      "MISSING_API_KEY",
      "No API key is saved for this model.",
    );
  }
  if (!config.model.trim()) {
    throw new AgentRequestError("INVALID_CONFIG", "Model ID is missing.");
  }

  const body = {
    model: config.model,
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: jsonSchemaName,
        strict: true,
        schema: z.toJSONSchema(schema, { target: "draft-7" }),
      },
    },
  };
  const serializedBody = JSON.stringify(body);
  if (byteLength(serializedBody) > MAX_REQUEST_BYTES) {
    throw new AgentRequestError(
      "IMAGE_TOO_LARGE",
      "The selected images are too large for one model request.",
    );
  }

  if (onStreamText) {
    try {
      const streamed = await streamStructuredOutput({
        apiKey,
        body: JSON.stringify({ ...body, stream: true }),
        config,
        fetchImpl: fetchImpl === fetch
          ? undefined
          : (fetchImpl as unknown as StreamingFetchLike),
        onStreamText,
        schema,
        signal,
      });
      onResponse?.();
      return streamed;
    } catch (error) {
      if (
        error instanceof AgentRequestError &&
        (error.code === "CANCELLED" || error.code === "TIMEOUT")
      ) {
        throw error;
      }
      // Streaming is best-effort: fall back to the classic request below.
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new AgentRequestError("CANCELLED", "The request was stopped.");
    }
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    signal?.addEventListener("abort", forwardAbort);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(endpointFor(config.baseUrl), {
        body: serializedBody,
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: controller.signal,
      });
      const responseText = await response.text();
      let envelope: {
        choices?: {
          finish_reason?: string;
          message?: { content?: string; refusal?: string };
        }[];
        error?: { message?: string };
      };
      try {
        envelope = JSON.parse(responseText) as typeof envelope;
      } catch {
        throw new AgentRequestError(
          "INVALID_RESPONSE",
          "The model returned a non-JSON response.",
          response.status,
        );
      }

      if (!response.ok) {
        const requestError = errorForStatus(
          response.status,
          envelope.error?.message,
        );
        if (
          attempt < maxAttempts &&
          (response.status === 429 || response.status >= 500)
        ) {
          await pause(retryDelayMs);
          continue;
        }
        throw requestError;
      }

      const message = envelope.choices?.[0]?.message;
      if (message?.refusal) {
        throw new AgentRequestError(
          "MODEL_REJECTED",
          "The model declined to analyze this input.",
        );
      }
      if (!message?.content) {
        throw new AgentRequestError(
          "INVALID_RESPONSE",
          "The model response did not contain structured output.",
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(message.content);
      } catch {
        if (envelope.choices?.[0]?.finish_reason === "length") {
          throw new AgentRequestError(
            "INVALID_RESPONSE",
            "The model response was truncated before the structured output finished.",
          );
        }
        throw new AgentRequestError(
          "INVALID_RESPONSE",
          "The model output was not valid JSON.",
        );
      }
      onResponse?.();
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new AgentRequestError(
          "INVALID_RESPONSE",
          "The model output did not match the ContactFlow schema.",
        );
      }
      return result.data;
    } catch (error) {
      if (error instanceof AgentRequestError) throw error;
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || controller.signal.aborted);
      if (aborted) {
        if (signal?.aborted) {
          throw new AgentRequestError("CANCELLED", "The request was stopped.");
        }
        throw new AgentRequestError(
          "TIMEOUT",
          "The model request timed out.",
        );
      }
      if (attempt < maxAttempts) {
        await pause(retryDelayMs);
        continue;
      }
      throw new AgentRequestError(
        "NETWORK",
        "Could not reach the model service.",
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", forwardAbort);
    }
  }

  throw new AgentRequestError("NETWORK", "Could not reach the model service.");
}

async function buildVisionContent(
  note: string,
  attachments: ChatAttachment[],
) {
  const realAttachments = attachments.filter(
    (attachment): attachment is ChatAttachment & { uri: string } =>
      Boolean(attachment.uri),
  );
  const render = async (maxEdge: number, quality: number) => {
    const images = await Promise.all(
      realAttachments.map((attachment) =>
        prepareImageDataUrl(attachment.uri, { maxEdge, quality }),
      ),
    );
    return [
      {
        type: "text" as const,
        text: note.trim() || "Analyze these chat screenshots.",
      },
      ...images.map((image) => ({
        type: "image_url" as const,
        image_url: { url: image.dataUrl },
      })),
    ];
  };

  const primary = await render(2000, 0.72);
  if (byteLength(JSON.stringify(primary)) <= MAX_REQUEST_BYTES - 20_000) {
    return primary;
  }
  return render(1400, 0.5);
}

function analysisPrompt(input: AnalyzeContextInput) {
  const memory = input.memories.slice(0, 20).map((fact) => ({
    contactName: fact.contactName,
    createdAt: fact.createdAt,
    id: fact.id,
    label: fact.label,
    source: fact.source,
    value: fact.value,
  }));
  const previous = input.previous;
  const previousBlock = previous
    ? `
This note is a follow-up in an ongoing conversation. Previous user note: ${JSON.stringify(previous.note)}
Previous proposals you returned (JSON): ${JSON.stringify(previous.proposals)}
If the new note modifies an earlier proposal (for example changing a time, name, or detail), return that proposal fully updated in place of the old one — never create a duplicate proposal for the same intent. Remove proposals the user explicitly cancels. Only create new proposals for genuinely new intents. Previous images keep their image:<1-based index> numbering and come before any new images.`
    : "";
  return `You are ContactFlow, a conservative relationship-action extractor.
Return only the provided JSON schema. Analyze the current note and every image.
Never invent people, phone numbers, companies, job titles, dates, or actions.
If a required fact is unclear, omit that proposal and add a notice.
Use absolute ISO-8601 date-times. The current time is ${input.now.toISOString()}, timezone ${input.timeZone}, locale ${input.locale}.
Meeting duration may default to 30 minutes only when the start is explicit; cite source system_default.
Image evidence sourceId is image:<1-based index>; note evidence sourceId is user_note.
Fill the "thinking" field first: 1-4 short sentences in locale ${input.locale} narrating what you see and decide as you analyze — concrete observations only, no boilerplate, no JSON terminology.
The following are previously confirmed local memories. Use one only when the current input clearly identifies the same person; cite its exact id as confirmed_memory. Ignore unrelated memories:
${JSON.stringify(memory)}${previousBlock}`;
}

export async function analyzeContext(
  input: AnalyzeContextInput,
): Promise<AnalysisResult> {
  input.onProgress?.("preparing_input");
  const apiKey = await readModelApiKey(input.config.id);
  const previousAttachments = (input.previous?.attachments ?? []).filter(
    (attachment) => attachment.uri,
  );
  const userContent = await buildVisionContent(input.note, [
    ...previousAttachments,
    ...input.attachments,
  ]);
  if (input.signal?.aborted) {
    throw new AgentRequestError("CANCELLED", "The request was stopped.");
  }
  input.onProgress?.("requesting_model");
  return requestStructuredOutput({
    apiKey: apiKey ?? "",
    config: input.config,
    jsonSchemaName: "contactflow_analysis",
    onResponse: () => input.onProgress?.("validating_schema"),
    onStreamText: input.onThinking,
    schema: AnalysisResultSchema,
    signal: input.signal,
    systemPrompt: analysisPrompt(input),
    userContent,
  });
}

export async function generateInsights(
  input: GenerateInsightsInput,
): Promise<InsightResult> {
  const apiKey = await readModelApiKey(input.config.id);
  const relevantMemories = input.memories
    .filter((memory) => memory.contactName === actionContactName(input.action))
    .slice(0, 20);
  const allowedEvidenceIds = new Set([
    ...relevantMemories.map((memory) => memory.id),
    ...input.action.evidence.map((evidence) => evidence.sourceId),
  ]);
  const allowedEvidenceIdList = [...allowedEvidenceIds];
  const result = await requestStructuredOutput({
    apiKey: apiKey ?? "",
    config: input.config,
    jsonSchemaName: "contactflow_insights",
    schema: InsightResultSchema,
    systemPrompt: `You generate 2-3 concise, evidence-backed relationship outputs after a user-confirmed action succeeded.
Return only the provided JSON schema in locale ${input.locale}.
Use only the supplied context, final action, and confirmed memories.
Return at least one item with kind "insight" explaining a useful relationship signal or change, and at least one item with kind "suggestion" proposing a concrete, user-controlled next step.
Suggestions may recommend an action but must never claim it already happened or trigger a tool.
If a suggestion is to email someone, include suggestedAction: { type: "send_email", to, subject, body } — "to" must be an email address that appears verbatim in the supplied context (leave it empty when none exists), and "body" must be a complete, ready-to-send email draft in locale ${input.locale} that references the confirmed facts. Never include suggestedAction for non-email suggestions.
Every evidenceIds item must exactly equal one of these allowed ids: ${JSON.stringify(allowedEvidenceIdList)}.
Do not cite any other id. Do not invent facts, generic advice, or unsupported conclusions.`,
    userContent: JSON.stringify({
      allowedEvidenceIds: allowedEvidenceIdList,
      finalAction: {
        evidence: input.action.evidence,
        payload: input.action.payload,
        type: input.action.type,
      },
      contextSummary: input.contextSummary,
      memories: relevantMemories,
    }),
  });
  if (
    result.insights.some((insight) =>
      insight.evidenceIds.some((id) => !allowedEvidenceIds.has(id)),
    )
  ) {
    throw new AgentRequestError(
      "INVALID_RESPONSE",
      "The model cited evidence that ContactFlow did not provide.",
    );
  }
  return result;
}

export function agentErrorMessage(error: unknown, locale: string) {
  const isZh = locale.startsWith("zh");
  const code =
    error instanceof AgentRequestError ? error.code : "NETWORK";
  const messages: Record<AgentErrorCode, [string, string]> = {
    UNSUPPORTED_PROVIDER: [
      "该 Provider 的协议暂未接通，请选择 OpenAI、DeepSeek 或 OpenAI Compatible。",
      "This provider protocol is not connected yet.",
    ],
    MISSING_API_KEY: [
      "这个模型没有可用的 API Key，请到模型设置中补充。",
      "No API key is saved for this model.",
    ],
    INVALID_CONFIG: [
      "模型 ID 或 Base URL 配置无效。",
      "The model ID or Base URL is invalid.",
    ],
    IMAGE_TOO_LARGE: [
      "图片压缩后仍超过模型限制，请减少选择的图片。",
      "The compressed images are still too large. Select fewer images.",
    ],
    AUTHENTICATION: [
      "API Key 无效、已过期，或当前账户无权使用这个模型。",
      "The API key is invalid, expired, or cannot access this model.",
    ],
    RATE_LIMITED: [
      "模型服务正忙或配额受限，请稍后重试。",
      "The model is busy or rate limited. Try again shortly.",
    ],
    TIMEOUT: [
      "模型分析超时，请检查网络后重试。",
      "The model request timed out. Check your connection and retry.",
    ],
    NETWORK: [
      "无法连接模型服务，请检查网络和 Base URL。",
      "Could not reach the model service. Check the network and Base URL.",
    ],
    MODEL_REJECTED: [
      "模型拒绝分析这份内容，请更换图片或补充说明。",
      "The model declined this input. Try another image or add context.",
    ],
    INVALID_RESPONSE: [
      "模型返回结果未通过 ContactFlow Schema 校验，没有生成任何动作。",
      "The model response failed ContactFlow schema validation. No action was created.",
    ],
    CANCELLED: ["已停止分析。", "Analysis stopped."],
  };
  return messages[code][isZh ? 0 : 1];
}
