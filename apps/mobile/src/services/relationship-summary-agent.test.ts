import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModelConfig } from "@/domain/model-config";
import type { RelationshipContact } from "@/domain/relationship-memory";
import { generateRelationshipSummary } from "@/services/relationship-summary-agent";

vi.mock("@/services/image-input", () => ({
  prepareImageDataUrl: vi.fn(),
}));

vi.mock("@/services/model-secrets", () => ({
  readModelApiKey: vi.fn(async () => "test-secret"),
}));

const config: ModelConfig = {
  baseUrl: "https://api.openai.com/v1",
  createdAt: "2026-08-19T00:00:00.000Z",
  hasApiKey: true,
  id: "model-1",
  model: "gpt-test",
  provider: "openai",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

const contact: RelationshipContact = {
  company: "Northstar",
  email: "taylor@northstar.ai",
  facts: [
    {
      contactName: "Taylor",
      createdAt: "2026-08-19T01:00:00.000Z",
      id: "memory-taylor",
      label: "联系方式",
      source: "已确认的新联系人",
      value: "13876543210",
    },
  ],
  id: "relationship-taylor",
  lastActivityAt: "2026-08-19T01:00:00.000Z",
  meetings: [
    {
      executedAt: "2026-08-19T01:00:00.000Z",
      id: "meeting-1",
      scheduledAt: "2026-08-21T15:00:00+08:00",
      title: "与 Taylor 同步",
    },
  ],
  name: "Taylor",
  phone: "13876543210",
};

const profile = { bio: "让每段关系都有下一步", email: "", name: "Ray" };

function jsonResponse(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: JSON.stringify(content) } },
      ],
    }),
    { status: 200 },
  );
}

describe("relationship summary agent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts confirmed relationship data and parses the summary", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ summary: "You and Taylor keep a steady cadence." }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const result = await generateRelationshipSummary({
      config,
      contact,
      locale: "en-US",
      profile,
    });

    expect(result.summary).toBe("You and Taylor keep a steady cadence.");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer test-secret");
    const body = JSON.parse(request.body);
    expect(body.response_format.json_schema.name).toBe(
      "contactflow_relationship_summary",
    );
    const payload = JSON.parse(body.messages[1].content);
    expect(payload.profile.name).toBe("Ray");
    expect(payload.contact).toMatchObject({
      name: "Taylor",
      phone: "13876543210",
    });
    expect(payload.contact.meetings[0].title).toBe("与 Taylor 同步");
    expect(payload.contact.facts[0].label).toBe("联系方式");
  });

  it("surfaces schema violations as AgentRequestError", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ summary: 42 }));
    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      generateRelationshipSummary({
        config,
        contact,
        locale: "zh-CN",
        profile,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
