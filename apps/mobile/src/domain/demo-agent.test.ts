import { describe, expect, it } from "vitest";

import {
  analyzeDemoContext,
  SAMPLE_CONTEXT,
  UPDATE_CONTEXT,
} from "./demo-agent";

describe("demo agent", () => {
  const now = new Date("2026-08-18T08:00:00+08:00");

  it("builds a meeting and contact proposal from the golden context", () => {
    const actions = analyzeDemoContext(SAMPLE_CONTEXT, now);

    expect(actions.map((action) => action.type)).toEqual([
      "create_meeting",
      "create_contact",
    ]);
    expect(actions[0].status).toBe("proposed");
    expect(
      actions[1].type === "create_contact" && actions[1].payload.phone,
    ).toBe("13800138000");
  });

  it("does not create a second contact when the intent is an update", () => {
    const actions = analyzeDemoContext(UPDATE_CONTEXT, now);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("update_contact");
    expect(
      actions[0].type === "update_contact" && actions[0].payload.company,
    ).toBe("Northstar Studio");
  });

  it("resolves the meeting into an absolute future time", () => {
    const meeting = analyzeDemoContext(SAMPLE_CONTEXT, now)[0];

    expect(meeting.type).toBe("create_meeting");
    if (meeting.type !== "create_meeting") return;
    expect(new Date(meeting.payload.startAt).getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect(
      new Date(meeting.payload.endAt).getTime() -
        new Date(meeting.payload.startAt).getTime(),
    ).toBe(30 * 60 * 1000);
  });
});
