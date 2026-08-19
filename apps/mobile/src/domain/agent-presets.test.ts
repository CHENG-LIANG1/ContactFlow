import { describe, expect, it } from "vitest";

import { AGENT_PRESETS } from "@/domain/agent-presets";

describe("agent presets", () => {
  it("covers each native action flow with a unique real screenshot", () => {
    expect(AGENT_PRESETS.map((preset) => preset.expectedActionType)).toEqual([
      "create_contact",
      "create_meeting",
      "update_contact",
    ]);
    expect(
      new Set(AGENT_PRESETS.map((preset) => preset.assetFileName)).size,
    ).toBe(3);
    expect(AGENT_PRESETS.map((preset) => preset.instruction.zh)).toEqual([
      "帮我新建一个联系人。",
      "帮我新建一个会议。",
      "帮我更新一下联系人。",
    ]);
    expect(
      AGENT_PRESETS.every(
        (preset) =>
          preset.instruction.zh.length > 0 &&
          preset.imageLabel.includes("Taylor"),
      ),
    ).toBe(true);
  });
});
