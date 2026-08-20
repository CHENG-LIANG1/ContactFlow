import { describe, expect, it } from "vitest";

import type { ActionProposal, HistoryRecord, MemoryFact } from "@/domain/actions";
import type { ChatSession } from "@/domain/chat";
import { buildRelationshipContacts } from "@/domain/relationship-memory";

describe("relationship memory graph", () => {
  it("aggregates confirmed contact facts and meetings without proposed actions", () => {
    const confirmedContact: ActionProposal = {
      confidence: "high",
      evidence: [{ excerpt: "Taylor", source: "image", sourceId: "image:1" }],
      id: "action-contact",
      payload: {
        company: "Northstar",
        email: "taylor@northstar.ai",
        familyName: "",
        givenName: "Taylor",
        phone: "13876543210",
      },
      status: "succeeded",
      type: "create_contact",
    };
    const confirmedMeeting: ActionProposal = {
      confidence: "high",
      evidence: [{ excerpt: "周五三点", source: "image", sourceId: "image:2" }],
      id: "action-meeting",
      payload: {
        contactName: "Taylor",
        endAt: "2026-08-21T15:30:00+08:00",
        location: "线上",
        startAt: "2026-08-21T15:00:00+08:00",
        title: "AI Search 项目沟通",
      },
      status: "succeeded",
      type: "create_meeting",
    };
    const proposedOnly: ActionProposal = {
      ...confirmedContact,
      id: "action-unconfirmed",
      payload: { ...confirmedContact.payload, givenName: "ShouldNotAppear" },
      status: "proposed",
    };
    const confirmedUpdate: ActionProposal = {
      confidence: "high",
      evidence: [{ excerpt: "Horizon AI", source: "image", sourceId: "image:3" }],
      id: "action-update",
      payload: {
        company: "Horizon AI",
        contactName: "Taylor",
        email: "taylor@horizon.ai",
        jobTitle: "AI 产品负责人",
      },
      status: "succeeded",
      type: "update_contact",
    };
    const sessions: ChatSession[] = [
      {
        id: "chat-1",
        title: "Taylor",
        turn: { attachments: [], note: "Taylor" },
        updatedAt: "2026-08-19T02:00:00.000Z",
        analysis: {
          actions: [confirmedUpdate, confirmedContact, confirmedMeeting, proposedOnly],
          thinking: "整理了 Taylor 的信息。",
          contextSummary: "",
          notices: [],
          participantNames: ["Taylor"],
        },
      },
    ];
    const history: HistoryRecord[] = [
      {
        actionId: "action-contact",
        contactName: "Taylor",
        executedAt: "2026-08-19T01:00:00.000Z",
        id: "history-contact",
        nativeObjectId: "native-contact",
        title: "保存 Taylor",
        type: "create_contact",
      },
      {
        actionId: "action-meeting",
        contactName: "Taylor",
        executedAt: "2026-08-19T02:00:00.000Z",
        id: "history-meeting",
        nativeObjectId: "native-meeting",
        title: "AI Search 项目沟通",
        type: "create_meeting",
      },
      {
        actionId: "action-update",
        contactName: "Taylor",
        executedAt: "2026-08-19T03:00:00.000Z",
        id: "history-update",
        nativeObjectId: "native-update",
        title: "更新 Taylor",
        type: "update_contact",
      },
    ];
    const memories: MemoryFact[] = [
      {
        contactName: "Taylor",
        createdAt: "2026-08-19T02:00:00.000Z",
        id: "memory-meeting",
        label: "下一次互动",
        source: "已确认的日历事件",
        value: "8月21日 15:00",
      },
    ];

    expect(buildRelationshipContacts({ chatSessions: sessions, history, memories })).toEqual([
      expect.objectContaining({
        company: "Horizon AI",
        email: "taylor@horizon.ai",
        jobTitle: "AI 产品负责人",
        name: "Taylor",
        phone: "13876543210",
        meetings: [
          expect.objectContaining({
            scheduledAt: "2026-08-21T15:00:00+08:00",
            title: "AI Search 项目沟通",
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(buildRelationshipContacts({ chatSessions: sessions, history, memories }))).not.toContain(
      "ShouldNotAppear",
    );
  });
});
