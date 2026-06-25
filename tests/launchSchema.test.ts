import { describe, expect, it } from "vitest";
import { launchRequestSchema } from "../src/shared/launchSchema";

const baseInput = {
  audience: "Engineering managers",
  launchDate: "2026-07-15",
  constraints: "",
  assets: "",
  humanHourlyRate: 2500,
  agentHourlyRate: 300
};

describe("launch request schema", () => {
  it("allows an empty product brief when a document is attached", () => {
    const result = launchRequestSchema.parse({
      ...baseInput,
      productBrief: "",
      attachments: [
        {
          id: "brief-file",
          name: "brief.md",
          type: "text/markdown",
          size: 64,
          text: "Build a launch plan from this attached product brief."
        }
      ]
    });

    expect(result.productBrief).toBe("");
    expect(result.attachments).toHaveLength(1);
  });

  it("requires brief text or at least one attachment", () => {
    expect(() =>
      launchRequestSchema.parse({
        ...baseInput,
        productBrief: "",
        attachments: []
      })
    ).toThrow(/brief/i);
  });
});
