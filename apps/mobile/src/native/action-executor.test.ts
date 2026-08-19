import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionProposal } from "@/domain/actions";
import { executeNativeAction } from "@/native/action-executor";

const calendarMocks = vi.hoisted(() => {
  const createEvent = vi.fn(async () => ({ id: "native-event" }));
  return {
    createEvent,
    getDefaultCalendarSync: vi.fn(() => ({ createEvent })),
    requestCalendarPermissions: vi.fn(async () => ({ granted: true })),
  };
});

const contactsMocks = vi.hoisted(() => {
  const patch = vi.fn(async () => undefined);
  const getEmails = vi.fn(async () => [
    { id: "home-email", label: "home", address: "zhou@example.com" },
    { id: "work-email", label: "work", address: "zhou@old.example.com" },
  ]);
  return {
    create: vi.fn(async () => ({ id: "native-contact" })),
    getEmails,
    patch,
    presentPicker: vi.fn(async () => ({ id: "picked-contact", getEmails, patch })),
    requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  };
});

vi.mock("expo-calendar", () => calendarMocks);
vi.mock("expo-contacts", () => ({
  Contact: {
    create: contactsMocks.create,
    presentPicker: contactsMocks.presentPicker,
  },
  requestPermissionsAsync: contactsMocks.requestPermissionsAsync,
}));

const baseAction = {
  confidence: "high",
  evidence: [
    { excerpt: "用户确认", source: "user_note", sourceId: "note:current" },
  ],
  id: "action-1",
  status: "proposed",
} satisfies Pick<ActionProposal, "confidence" | "evidence" | "id" | "status">;

describe("native action executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests full Calendar access before using the default calendar", async () => {
    const action: ActionProposal = {
      ...baseAction,
      payload: {
        contactName: "周宁",
        endAt: "2026-08-25T10:30:00+08:00",
        location: "",
        startAt: "2026-08-25T10:00:00+08:00",
        title: "与周宁会面",
      },
      type: "create_meeting",
    };

    await expect(executeNativeAction(action)).resolves.toMatchObject({
      nativeObjectId: "native-event",
    });
    expect(calendarMocks.requestCalendarPermissions).toHaveBeenCalledWith(false);
    expect(calendarMocks.getDefaultCalendarSync).toHaveBeenCalledOnce();
    expect(calendarMocks.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: "与周宁会面" }),
    );
  });

  it("creates a confirmed contact through the native Contacts API", async () => {
    const action: ActionProposal = {
      ...baseAction,
      payload: {
        company: "ContactFlow",
        familyName: "周",
        givenName: "宁",
        phone: "+86 138 0000 0000",
        email: "zhou@contactflow.example",
      },
      type: "create_contact",
    };

    await expect(executeNativeAction(action)).resolves.toMatchObject({
      nativeObjectId: "native-contact",
    });
    expect(contactsMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ givenName: "宁" }),
    );
  });

  it("patches only the fields proposed for the picked contact", async () => {
    const action: ActionProposal = {
      ...baseAction,
      payload: {
        company: "ContactFlow",
        contactName: "周宁",
        jobTitle: "Product Lead",
        email: "zhou@contactflow.example",
      },
      type: "update_contact",
    };

    await expect(executeNativeAction(action)).resolves.toMatchObject({
      nativeObjectId: "picked-contact",
    });
    expect(contactsMocks.patch).toHaveBeenCalledWith({
      company: "ContactFlow",
      emails: [
        { id: "home-email", label: "home", address: "zhou@example.com" },
        { label: "work", address: "zhou@contactflow.example" },
      ],
      jobTitle: "Product Lead",
    });
  });
});
