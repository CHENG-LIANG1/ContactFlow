import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ModelConfig } from "@/domain/model-config";
import {
  AnalysisResultSchema,
  proposalsFromAnalysis,
} from "@/domain/actions";
import {
  AgentRequestError,
  analyzeContext,
  generateInsights,
  requestStructuredOutput,
} from "@/services/openai-compatible-agent";

vi.mock("@/services/image-input", () => ({
  prepareImageDataUrl: vi.fn(async () => ({
    dataUrl: "data:image/jpeg;base64,aW1hZ2U=",
    height: 120,
    width: 80,
  })),
}));

vi.mock("@/services/model-secrets", () => ({
  readModelApiKey: vi.fn(async () => "test-secret"),
}));

const config: ModelConfig = {
  baseUrl: "https://api.kimi.test/coding/v1/",
  createdAt: "2026-08-19T00:00:00.000Z",
  hasApiKey: true,
  id: "model-kimi",
  model: "k3",
  provider: "openai-compatible",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

const analysisResult = {
  contextSummary: "林澈确认了下周二的会议",
  notices: [],
  participantNames: ["林澈"],
  proposals: [
    {
      confidence: "high",
      evidence: [
        {
          excerpt: "下周二上午十点",
          source: "image",
          sourceId: "image:1",
        },
        {
          excerpt: "林澈的历史职位",
          source: "confirmed_memory",
          sourceId: "memory-old",
        },
      ],
      payload: {
        contactName: "林澈",
        endAt: "2026-08-25T10:30:00+08:00",
        location: "",
        startAt: "2026-08-25T10:00:00+08:00",
        title: "与林澈会面",
      },
      type: "create_meeting",
    },
  ],
};

function jsonResponse(content: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status >= 400
        ? { error: { message: String(content) } }
        : {
            choices: [
              { finish_reason: "stop", message: { content: JSON.stringify(content) } },
            ],
          },
    ),
    { status },
  );
}

describe("OpenAI-compatible agent adapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the selected endpoint, secret header, and strict JSON schema", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const schema = z.strictObject({ ok: z.boolean() });

    await expect(
      requestStructuredOutput({
        apiKey: " test-secret ",
        config,
        fetchImpl: fetchImpl as typeof fetch,
        jsonSchemaName: "probe",
        maxAttempts: 1,
        schema,
        systemPrompt: "Return data.",
        userContent: "hello",
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit,
    ];
    const body = JSON.parse(String(request?.body));
    expect(url).toBe("https://api.kimi.test/coding/v1/chat/completions");
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer test-secret",
    });
    expect(body).toMatchObject({
      model: "k3",
      response_format: {
        json_schema: { name: "probe", strict: true },
        type: "json_schema",
      },
    });
    expect(JSON.stringify(body)).not.toContain("test-secret");
  });

  it("passes real image data and confirmed memory into analysis", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(analysisResult));
    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      analyzeContext({
        attachments: [
          { isDemo: false, label: "chat.jpg", uri: "file:///chat.jpg" },
        ],
        config,
        locale: "zh-CN",
        memories: [
          {
            contactName: "林澈",
            createdAt: "2026-08-18T00:00:00.000Z",
            id: "memory-old",
            label: "职位",
            source: "已确认联系人",
            value: "Design Lead",
          },
        ],
        note: "请安排后续",
        now: new Date("2026-08-19T00:00:00.000Z"),
        timeZone: "Asia/Shanghai",
      }),
    ).resolves.toMatchObject({ participantNames: ["林澈"] });

    const [, request] = fetchImpl.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit,
    ];
    const body = JSON.parse(String(request.body));
    expect(body.messages[0].content).toContain("memory-old");
    expect(body.messages[1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image_url: { url: "data:image/jpeg;base64,aW1hZ2U=" },
          type: "image_url",
        }),
      ]),
    );
  });

  it("rejects invalid schema output and unsupported providers", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: "not-boolean" }));
    await expect(
      requestStructuredOutput({
        apiKey: "secret",
        config,
        fetchImpl: fetchImpl as typeof fetch,
        jsonSchemaName: "probe",
        maxAttempts: 1,
        schema: z.strictObject({ ok: z.boolean() }),
        systemPrompt: "Return data.",
        userContent: "hello",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    await expect(
      requestStructuredOutput({
        apiKey: "secret",
        config: { ...config, provider: "anthropic" },
        fetchImpl: fetchImpl as typeof fetch,
        jsonSchemaName: "probe",
        schema: z.strictObject({ ok: z.boolean() }),
        systemPrompt: "Return data.",
        userContent: "hello",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_PROVIDER" });
  });

  it("retries a transient provider error once but not authentication", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("busy", 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await requestStructuredOutput({
      apiKey: "secret",
      config,
      fetchImpl: fetchImpl as typeof fetch,
      jsonSchemaName: "probe",
      retryDelayMs: 0,
      schema: z.strictObject({ ok: z.boolean() }),
      systemPrompt: "Return data.",
      userContent: "hello",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const authFetch = vi.fn(async () => jsonResponse("invalid", 401));
    await expect(
      requestStructuredOutput({
        apiKey: "secret",
        config,
        fetchImpl: authFetch as typeof fetch,
        jsonSchemaName: "probe",
        schema: z.strictObject({ ok: z.boolean() }),
        systemPrompt: "Return data.",
        userContent: "hello",
      }),
    ).rejects.toBeInstanceOf(AgentRequestError);
    expect(authFetch).toHaveBeenCalledOnce();
  });

  it("accepts only insight evidence ids that were actually supplied", async () => {
    const action = proposalsFromAnalysis(
      AnalysisResultSchema.parse(analysisResult),
    )[0];
    action.status = "succeeded";
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        insights: [
          {
            body: "会前确认对方当前职责。",
            evidenceIds: ["memory-action-1"],
            title: "会前核对",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      generateInsights({
        action,
        config,
        contextSummary: "已安排会议",
        locale: "zh-CN",
        memories: [
          {
            contactName: "林澈",
            createdAt: "2026-08-19T00:00:00.000Z",
            id: "memory-action-1",
            label: "下一次互动",
            source: "已确认的日历事件",
            value: "8月25日 10:00",
          },
        ],
      }),
    ).resolves.toMatchObject({ insights: [{ evidenceIds: ["memory-action-1"] }] });

    const [, insightRequest] = fetchImpl.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit,
    ];
    const insightBody = JSON.parse(String(insightRequest.body));
    expect(insightBody.messages[0].content).toContain("memory-action-1");
    expect(insightBody.messages[1].content).not.toContain(action.id);

    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        insights: [
          { body: "无依据", evidenceIds: ["invented"], title: "错误" },
        ],
      }),
    );
    await expect(
      generateInsights({
        action,
        config,
        contextSummary: "已安排会议",
        locale: "zh-CN",
        memories: [],
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
