import { describe, expect, it } from "vitest";

import { RelationshipSummaryResultSchema } from "@/domain/relationship-summary";

describe("relationship summary schema", () => {
  it("accepts a summary string", () => {
    const result = RelationshipSummaryResultSchema.safeParse({
      summary: "你与 Taylor 保持稳定的互动节奏。",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing or non-string summary", () => {
    expect(RelationshipSummaryResultSchema.safeParse({}).success).toBe(false);
    expect(
      RelationshipSummaryResultSchema.safeParse({ summary: 42 }).success,
    ).toBe(false);
  });
});
