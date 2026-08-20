import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatTurn } from "@/domain/chat";
import type { ModelConfig } from "@/domain/model-config";
import {
  AgentRequestError,
  analyzeContext,
} from "@/services/openai-compatible-agent";
import {
  analysisSteps,
  createAnalysisAdapter,
  resultReasoning,
  resultText,
  turnFromUserMessage,
  type AnalysisBridge,
} from "@/services/analysis-runtime";
import type { ThreadMessage } from "@assistant-ui/react-native";

vi.mock("@/services/openai-compatible-agent", () => {
  class AgentRequestError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status?: number,
    ) {
      super(message);
      this.name = "AgentRequestError";
    }
  }
  return {
    AgentRequestError,
    analyzeContext: vi.fn(),
    agentErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
  };
});

const analyzeContextMock = vi.mocked(analyzeContext);

const model: ModelConfig = {
  baseUrl: "https://api.kimi.test/coding/v1/",
  createdAt: "2026-08-19T00:00:00.000Z",
  hasApiKey: true,
  id: "model-kimi",
  model: "k3",
  provider: "openai-compatible",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

const analysisResult = {
  thinking: "看到了林澈确认下周二的会议。",
  contextSummary: "林澈确认了下周二的会议",
  notices: [],
  participantNames: ["林澈"],
  proposals: [
    {
      confidence: "high" as const,
      evidence: [
        {
          source: "image" as const,
          sourceId: "img-1",
          excerpt: "下周二下午三点",
        },
      ],
      payload: {
        contactName: "林澈",
        endAt: "2026-08-25T16:00:00.000+08:00",
        location: "",
        startAt: "2026-08-25T15:00:00.000+08:00",
        title: "项目周会",
      },
      type: "create_meeting" as const,
    },
  ],
};

function userMessage(note: string): ThreadMessage {
  return {
    role: "user",
    id: "msg-user",
    createdAt: new Date(),
    content: [{ type: "text", text: note }],
    attachments: [
      {
        id: "att-1",
        type: "image",
        name: "截图",
        contentType: "image/jpeg",
        status: { type: "complete" },
        content: [{ type: "image", image: "file:///chat.png" }],
      },
    ],
    metadata: {},
  } as unknown as ThreadMessage;
}

function makeBridge(overrides: Partial<AnalysisBridge> = {}) {
  const events: string[] = [];
  const bridge: AnalysisBridge = {
    getContext: () => ({
      language: "zh",
      memories: [],
      model,
      previous: null,
    }),
    onRunError: () => void events.push("error"),
    onRunSettled: () => void events.push("settled"),
    onRunStart: () => void events.push("start"),
    onRunSuccess: () => void events.push("success"),
    ...overrides,
  };
  return { bridge, events };
}

async function collectRun(
  adapter: ReturnType<typeof createAnalysisAdapter>,
  messages: ThreadMessage[],
) {
  const run = adapter.run({
    messages,
    runConfig: {},
    abortSignal: new AbortController().signal,
    context: {},
    unstable_getMessage: () => messages[0],
  });
  const results = [];
  if (run && typeof run === "object" && Symbol.asyncIterator in run) {
    for await (const update of run) results.push(update);
  }
  return results;
}

beforeEach(() => {
  analyzeContextMock.mockReset();
});

describe("analysisSteps", () => {
  it("describes the current stage in one line", () => {
    expect(
      analysisSteps("preparing_input", {
        attachmentCount: 2,
        language: "zh",
        modelName: "k3",
      }),
    ).toBe("读取文字与2 张截图，压缩图片并移除原始元数据");
    expect(
      analysisSteps("requesting_model", {
        attachmentCount: 2,
        language: "zh",
        modelName: "k3",
      }),
    ).toContain("k3");
    expect(
      analysisSteps("validating_schema", {
        attachmentCount: 1,
        language: "en",
        modelName: "k3",
      }),
    ).toContain("Validating");
  });
});

describe("resultReasoning / resultText", () => {
  it("summarizes the completed analysis", () => {
    const reasoning = resultReasoning({
      attachmentCount: 1,
      language: "zh",
      modelName: "k3",
      result: analysisResult,
    });
    expect(reasoning).toContain("校验通过");
    expect(resultText({
      actionCount: 1,
      language: "zh",
      notices: [],
    })).toContain("1 个");
  });
});

describe("turnFromUserMessage", () => {
  it("extracts note and attachments from a runtime user message", () => {
    const turn: ChatTurn = turnFromUserMessage(userMessage("帮我安排会议"));
    expect(turn.note).toBe("帮我安排会议");
    expect(turn.attachments).toEqual([
      { isDemo: false, label: "截图", uri: "file:///chat.png" },
    ]);
  });
});

describe("createAnalysisAdapter", () => {
  it("streams reasoning updates and returns the final result", async () => {
    analyzeContextMock.mockImplementation(async ({ onProgress }) => {
      onProgress?.("requesting_model");
      onProgress?.("validating_schema");
      return analysisResult;
    });
    const { bridge, events } = makeBridge();
    const adapter = createAnalysisAdapter(() => bridge);

    const updates = await collectRun(adapter, [userMessage("安排会议")]);

    // initial yield + one per progress stage + final result
    expect(updates.length).toBe(4);
    // process accumulates line by line while running
    const firstReasoning = updates[0].content?.[0];
    const secondReasoning = updates[1].content?.[0];
    const thirdReasoning = updates[2].content?.[0];
    expect(firstReasoning).toMatchObject({ type: "reasoning" });
    expect(
      (secondReasoning as { text: string }).text.split("\n").length,
    ).toBe(2);
    expect(
      (thirdReasoning as { text: string }).text.split("\n").length,
    ).toBe(3);
    const final = updates[updates.length - 1];
    expect(final.content?.[1]).toMatchObject({ type: "text" });
    expect(final.metadata?.custom).toMatchObject({
      elapsedMs: expect.any(Number),
      kind: "actions",
    });
    expect(events).toEqual(["start", "success", "settled"]);
  });

  it("marks cancellation without an error callback", async () => {
    analyzeContextMock.mockRejectedValue(
      new AgentRequestError("CANCELLED", "aborted"),
    );
    const { bridge, events } = makeBridge();
    const adapter = createAnalysisAdapter(() => bridge);

    const updates = await collectRun(adapter, [userMessage("安排会议")]);
    const final = updates[updates.length - 1];

    expect(final.status).toMatchObject({
      type: "incomplete",
      reason: "cancelled",
    });
    expect(events).toEqual(["start", "settled"]);
  });

  it("returns an error message tagged for retry when the request fails", async () => {
    analyzeContextMock.mockRejectedValue(
      new AgentRequestError("NETWORK", "offline"),
    );
    const { bridge, events } = makeBridge();
    const adapter = createAnalysisAdapter(() => bridge);

    const updates = await collectRun(adapter, [userMessage("安排会议")]);
    const final = updates[updates.length - 1];

    expect(final.status).toMatchObject({ type: "incomplete", reason: "error" });
    expect(final.metadata?.custom).toMatchObject({ kind: "error" });
    expect(events).toEqual(["start", "error", "settled"]);
  });

  it("fails fast when no model is configured", async () => {
    const { bridge, events } = makeBridge({
      getContext: () => ({
        language: "zh",
        memories: [],
        model: null,
        previous: null,
      }),
    });
    const adapter = createAnalysisAdapter(() => bridge);

    const updates = await collectRun(adapter, [userMessage("安排会议")]);
    const final = updates[updates.length - 1];

    expect(analyzeContextMock).not.toHaveBeenCalled();
    expect(final.metadata?.custom).toMatchObject({ kind: "error" });
    expect(events).toEqual(["start", "error", "settled"]);
  });
});
