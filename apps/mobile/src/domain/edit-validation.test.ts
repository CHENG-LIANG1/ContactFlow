import { describe, expect, it } from "vitest";

import type { ActionProposal } from "@/domain/actions";
import { validateActionEdit } from "@/domain/edit-validation";

const evidence = {
  excerpt: "林澈 · 13800138000",
  source: "user_note" as const,
  sourceId: "user_note",
};

const meetingAction = {
  confidence: "high" as const,
  evidence: [evidence],
  id: "action-meeting",
  status: "proposed" as const,
  type: "create_meeting" as const,
  payload: {
    contactName: "林澈",
    endAt: "2026-08-25T10:30:00+08:00",
    location: "",
    startAt: "2026-08-25T10:00:00+08:00",
    title: "和林澈沟通",
  },
} satisfies ActionProposal;

const contactAction = {
  confidence: "medium" as const,
  evidence: [evidence],
  id: "action-contact",
  status: "proposed" as const,
  type: "create_contact" as const,
  payload: {
    company: "",
    email: "",
    familyName: "林",
    givenName: "澈",
    phone: "13800138000",
  },
} satisfies ActionProposal;

const updateAction = {
  confidence: "high" as const,
  evidence: [evidence],
  id: "action-update",
  status: "proposed" as const,
  type: "update_contact" as const,
  payload: {
    company: "Northstar Studio",
    contactName: "林澈",
    email: "",
    jobTitle: "Design Lead",
  },
} satisfies ActionProposal;

describe("validateActionEdit", () => {
  it("accepts an untouched meeting draft", () => {
    expect(
      validateActionEdit(meetingAction, {
        title: "和林澈沟通",
        startAt: meetingAction.payload.startAt,
        endAt: meetingAction.payload.endAt,
        location: "",
      }),
    ).toEqual({});
  });

  it("flags a blank meeting title and an end not after the start", () => {
    expect(
      validateActionEdit(meetingAction, {
        title: "   ",
        startAt: meetingAction.payload.startAt,
        endAt: meetingAction.payload.startAt,
        location: "",
      }),
    ).toEqual({ title: "required", endAt: "endAfterStart" });
  });

  it("flags blank name, malformed phone, and malformed email on contacts", () => {
    expect(
      validateActionEdit(contactAction, {
        name: "",
        phone: "abc",
        company: "",
        email: "not-an-email",
      }),
    ).toEqual({ name: "required", phone: "phone", email: "email" });
    expect(
      validateActionEdit(contactAction, {
        name: "林澈",
        phone: "",
        company: "",
        email: "",
      }),
    ).toEqual({ phone: "required" });
  });

  it("requires company and role for contact updates", () => {
    expect(
      validateActionEdit(updateAction, {
        company: "",
        jobTitle: "",
        email: "taylor@northstar.ai",
      }),
    ).toEqual({ company: "required", jobTitle: "required" });
  });
});
