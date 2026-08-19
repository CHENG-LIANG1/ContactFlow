import { describe, expect, it } from "vitest";

import {
  AnalysisResultSchema,
  InsightResultSchema,
  isActionValidForExecution,
  proposalsFromAnalysis,
} from "@/domain/actions";

const evidence = {
  excerpt: "林澈 · 13800138000",
  source: "user_note" as const,
  sourceId: "user_note",
};

const validResult = {
  contextSummary: "与林澈的后续安排",
  participantNames: ["林澈"],
  proposals: [
    {
      confidence: "high" as const,
      evidence: [evidence],
      payload: {
        contactName: "林澈",
        endAt: "2026-08-25T10:30:00+08:00",
        location: "",
        startAt: "2026-08-25T10:00:00+08:00",
        title: "和林澈沟通",
      },
      type: "create_meeting" as const,
    },
    {
      confidence: "medium" as const,
      evidence: [evidence],
      payload: {
        company: "",
        familyName: "林",
        givenName: "澈",
        phone: "13800138000",
        email: "",
      },
      type: "create_contact" as const,
    },
    {
      confidence: "high" as const,
      evidence: [evidence],
      payload: {
        company: "Northstar Studio",
        contactName: "林澈",
        jobTitle: "Design Lead",
        email: "",
      },
      type: "update_contact" as const,
    },
  ],
  notices: [],
};

describe("agent runtime contracts", () => {
  it("keeps a no-action analysis empty without inserting sample data", () => {
    const parsed = AnalysisResultSchema.parse({
      contextSummary: "普通图片，没有关系行动",
      notices: [{ code: "NO_ACTION", message: "没有可执行动作" }],
      participantNames: [],
      proposals: [],
    });

    expect(proposalsFromAnalysis(parsed)).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain("林澈");
  });

  it("accepts all three action variants and assigns local runtime fields", () => {
    const parsed = AnalysisResultSchema.parse(validResult);
    const actions = proposalsFromAnalysis(
      parsed,
      new Date("2026-08-19T00:00:00.000Z"),
    );

    expect(actions.map((action) => action.type)).toEqual([
      "create_meeting",
      "create_contact",
      "update_contact",
    ]);
    expect(actions.every(isActionValidForExecution)).toBe(true);
    expect(actions[0]).toMatchObject({
      id: "action-1787097600000-0",
      status: "proposed",
    });
  });

  it("keeps a single evidenced Latin name only once", () => {
    const parsed = AnalysisResultSchema.parse({
      contextSummary: "Taylor shared contact details.",
      notices: [],
      participantNames: ["Taylor"],
      proposals: [
        {
          confidence: "high",
          evidence: [
            {
              excerpt: "我是 Taylor",
              source: "image",
              sourceId: "image:1",
            },
          ],
          payload: {
            company: "Northstar",
            email: "taylor@northstar.ai",
            familyName: "Taylor",
            givenName: "Taylor",
            phone: "13876543210",
          },
          type: "create_contact",
        },
      ],
    });

    expect(proposalsFromAnalysis(parsed)[0]?.payload).toMatchObject({
      familyName: "",
      givenName: "Taylor",
    });
  });

  it("rejects model-owned runtime state, extra fields, and invalid times", () => {
    expect(
      AnalysisResultSchema.safeParse({
        ...validResult,
        proposals: [
          {
            ...validResult.proposals[0],
            status: "succeeded",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      AnalysisResultSchema.safeParse({
        ...validResult,
        proposals: [
          {
            ...validResult.proposals[0],
            payload: {
              ...validResult.proposals[0].payload,
              endAt: "2026-08-25T09:00:00+08:00",
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects blank contacts and malformed insight/suggestion pairs", () => {
    expect(
      AnalysisResultSchema.safeParse({
        ...validResult,
        proposals: [
          {
            ...validResult.proposals[1],
            payload: {
              company: "",
              familyName: "",
              givenName: "",
              phone: "13800138000",
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      InsightResultSchema.safeParse({
        insights: [
          {
            body: "对方已确认会议时间。",
            evidenceIds: ["memory-1"],
            kind: "insight",
            title: "时间已确认",
          },
          {
            body: "会前发送议程。",
            evidenceIds: [],
            kind: "suggestion",
            title: "准备议程",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      InsightResultSchema.safeParse({
        insights: [
          {
            body: "对方已确认会议时间。",
            evidenceIds: ["memory-1"],
            kind: "insight",
            title: "时间已确认",
          },
          {
            body: "联系人已经更新职位。",
            evidenceIds: ["memory-2"],
            kind: "insight",
            title: "职责有变化",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      InsightResultSchema.safeParse({
        insights: [
          {
            body: "对方已确认会议时间。",
            evidenceIds: ["memory-1"],
            kind: "insight",
            title: "时间已确认",
          },
          {
            body: "会前发送议程。",
            evidenceIds: ["memory-1"],
            kind: "suggestion",
            title: "准备议程",
          },
        ],
      }).success,
    ).toBe(true);
  });
});
