import { describe, expect, it } from "vitest";

import { moveMeetingStart } from "./meeting-edit";

describe("moveMeetingStart", () => {
  it("preserves the existing meeting duration", () => {
    expect(
      moveMeetingStart(
        "2026-08-25T02:00:00.000Z",
        "2026-08-25T02:45:00.000Z",
        new Date("2026-08-26T05:30:00.000Z"),
      ),
    ).toEqual({
      startAt: "2026-08-26T05:30:00.000Z",
      endAt: "2026-08-26T06:15:00.000Z",
    });
  });

  it("uses a 30 minute duration when the existing range is invalid", () => {
    expect(
      moveMeetingStart(
        "invalid",
        "also-invalid",
        new Date("2026-08-26T05:30:00.000Z"),
      ),
    ).toEqual({
      startAt: "2026-08-26T05:30:00.000Z",
      endAt: "2026-08-26T06:00:00.000Z",
    });
  });
});
