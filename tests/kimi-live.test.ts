import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  AnalysisResultSchema,
  InsightResultSchema,
} from "@/domain/actions";
import { AGENT_PRESETS } from "@/domain/agent-presets";
import type { ModelConfig } from "@/domain/model-config";
import { requestStructuredOutput } from "@/services/openai-compatible-agent";

vi.mock("@/services/image-input", () => ({
  prepareImageDataUrl: vi.fn(),
}));

vi.mock("@/services/model-secrets", () => ({
  readModelApiKey: vi.fn(),
}));

const apiKey = process.env.CONTACTFLOW_KIMI_KEY;
const liveScreenshotPath = process.env.CONTACTFLOW_LIVE_SCREENSHOT;
const liveDescribe = apiKey ? describe : describe.skip;
const liveScreenshotIt = apiKey && liveScreenshotPath ? it : it.skip;
const config: ModelConfig = {
  baseUrl: "https://api.kimi.com/coding/v1",
  createdAt: "2026-08-19T00:00:00.000Z",
  hasApiKey: true,
  id: "live-kimi-k3",
  model: "k3",
  provider: "openai-compatible",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

liveDescribe("Kimi K3 live contract", () => {
  it.each(AGENT_PRESETS)(
    "runs the $id screenshot preset through the real structured agent",
    async (preset) => {
      const assetPath = fileURLToPath(
        new URL(
          `../apps/mobile/assets/e2e/${preset.assetFileName}`,
          import.meta.url,
        ),
      );
      const image = readFileSync(assetPath).toString("base64");
      const result = await requestStructuredOutput({
        apiKey: apiKey ?? "",
        config,
        jsonSchemaName: `contactflow_${preset.id}_e2e`,
        maxAttempts: 1,
        schema: AnalysisResultSchema,
        systemPrompt: `You are ContactFlow. Current time: 2026-08-19T22:01:00+08:00. Timezone: Asia/Shanghai.
Follow the user's requested action scope exactly. Extract every field supported by the schema, including email. Use image evidence with sourceId image:1 for visible facts. Return the schema exactly.`,
        userContent: [
          { type: "text", text: preset.instruction.zh },
          {
            image_url: { url: `data:image/jpeg;base64,${image}` },
            type: "image_url",
          },
        ],
      });

      expect(result.proposals.map((proposal) => proposal.type)).toContain(
        preset.expectedActionType,
      );
      expect(JSON.stringify(result)).toContain("Taylor");
      expect(
        result.proposals.flatMap((proposal) => proposal.evidence),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "image", sourceId: "image:1" }),
        ]),
      );
    },
    90_000,
  );

  liveScreenshotIt(
    "extracts person, time, and phone only from a real app screenshot",
    async () => {
      const image = readFileSync(liveScreenshotPath ?? "").toString("base64");
      const result = await requestStructuredOutput({
        apiKey: apiKey ?? "",
        config,
        jsonSchemaName: "contactflow_real_screenshot_live",
        maxAttempts: 1,
        schema: AnalysisResultSchema,
        systemPrompt: `Extract only evidence-backed ContactFlow actions from the supplied app screenshot.
Current time: 2026-08-19T21:45:00+08:00. Timezone: Asia/Shanghai.
The screenshot contains a meeting card and a contact card. Return both actions. Use absolute ISO-8601 date-times with the +08:00 offset.
All visible facts must cite image evidence with sourceId image:1. Do not use user_note evidence. Return the schema exactly.`,
        userContent: [
          { type: "text", text: "Analyze the screenshot only." },
          {
            image_url: { url: `data:image/jpeg;base64,${image}` },
            type: "image_url",
          },
        ],
      });

      expect(result.proposals.map((proposal) => proposal.type)).toEqual(
        expect.arrayContaining(["create_meeting", "create_contact"]),
      );
      expect(JSON.stringify(result)).toContain("林澈");
      expect(JSON.stringify(result).replace(/\s/g, "")).toContain("13800138000");
      expect(
        result.proposals.flatMap((proposal) => proposal.evidence),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: "image", sourceId: "image:1" }),
        ]),
      );
    },
    90_000,
  );

  it(
    "returns a ContactFlow action through the complete runtime schema",
    async () => {
      const result = await requestStructuredOutput({
        apiKey: apiKey ?? "",
        config,
        jsonSchemaName: "contactflow_analysis_live",
        maxAttempts: 1,
        schema: AnalysisResultSchema,
        systemPrompt: `Extract only evidence-backed ContactFlow actions. Return the schema exactly.
Current time: 2026-08-19T09:00:00+08:00. Timezone: Asia/Shanghai.
Use source user_note with sourceId user_note for note evidence.`,
        userContent:
          "下周二上午十点和周宁开 30 分钟产品会议，地点是上海办公室。",
      });

      expect(result.proposals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "create_meeting" }),
        ]),
      );
      expect(JSON.stringify(result)).toContain("周宁");
    },
    90_000,
  );

  it(
    "accepts a real base64 image without fabricating an action",
    async () => {
      const assetPath = fileURLToPath(
        new URL(
          "../apps/mobile/assets/images/tutorial-web.png",
          import.meta.url,
        ),
      );
      const image = readFileSync(assetPath).toString("base64");
      const result = await requestStructuredOutput({
        apiKey: apiKey ?? "",
        config,
        jsonSchemaName: "contactflow_vision_live",
        maxAttempts: 1,
        schema: AnalysisResultSchema,
        systemPrompt: `Read the image and return the schema exactly.
Put the prominent heading in contextSummary. This is not a chat and has no relationship action, so proposals must be empty and notices must include NO_ACTION.`,
        userContent: [
          { type: "text", text: "Read the prominent heading." },
          {
            image_url: { url: `data:image/png;base64,${image}` },
            type: "image_url",
          },
        ],
      });

      expect(result.contextSummary.toLowerCase()).toContain("expo");
      expect(result.proposals).toEqual([]);
      expect(JSON.stringify(result)).not.toContain("林澈");
    },
    90_000,
  );

  it(
    "returns evidence-linked insights through the complete runtime schema",
    async () => {
      const result = await requestStructuredOutput({
        apiKey: apiKey ?? "",
        config,
        jsonSchemaName: "contactflow_insights_live",
        maxAttempts: 1,
        schema: InsightResultSchema,
        systemPrompt: `Generate 1-3 concise relationship insights in zh-CN after a confirmed action succeeded.
Use only the supplied action and confirmed memory. Every evidenceIds item must exactly equal one of: memory-live, user_note. Return the schema exactly.`,
        userContent: JSON.stringify({
          action: {
            confidence: "high",
            evidence: [
              {
                excerpt: "下周二上午十点和林澈演示",
                source: "user_note",
                sourceId: "user_note",
              },
            ],
            id: "action-live",
            payload: {
              contactName: "林澈",
              endAt: "2026-08-25T10:30:00+08:00",
              location: "",
              startAt: "2026-08-25T10:00:00+08:00",
              title: "与林澈聊 ContactFlow 演示",
            },
            status: "succeeded",
            type: "create_meeting",
          },
          contextSummary: "用户确认与林澈进行产品演示会议",
          memories: [
            {
              contactName: "林澈",
              createdAt: "2026-08-19T13:41:00.000Z",
              id: "memory-live",
              label: "最近一次会面",
              source: "已确认会议",
              value: "2026-08-25T10:00:00+08:00",
            },
          ],
        }),
      });

      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].evidenceIds).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(memory-live|user_note)$/)]),
      );
    },
    90_000,
  );
});
