import { describe, expect, it } from "vitest";
import { checkLaunchReadiness, draftLaunchCopy, extractLaunchTasks, generateOwnerChecklist } from "../src/tools/launchTools";

const launchInput = {
  productBrief:
    "Launch release scorecards for engineering managers with success metrics, deployment confidence, and blockers.",
  audience: "Engineering managers",
  launchDate: "2026-07-15",
  constraints: "Include rollback guidance, support path, monitoring links, and incident escalation.",
  assets: "Dashboard mockups, beta feedback quotes, and product spec",
  humanHourlyRate: 2500,
  agentHourlyRate: 300
};

describe("launch planning tools", () => {
  it("extracts prioritized launch tasks", () => {
    const result = extractLaunchTasks(launchInput);
    expect(result.tasks.length).toBeGreaterThanOrEqual(4);
    expect(result.tasks[0].priority).toBe("P0");
  });

  it("checks readiness with a rubric", () => {
    const result = checkLaunchReadiness(launchInput);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.rubric.map((item) => item.area)).toContain("Operational readiness");
  });

  it("generates owner checklists", () => {
    const result = generateOwnerChecklist(launchInput);
    expect(result.owners.some((owner) => owner.ownerRole === "Engineering Lead")).toBe(true);
  });

  it("drafts channel-specific launch copy", () => {
    const result = draftLaunchCopy(launchInput);
    expect(result.channels.map((channel) => channel.channel)).toContain("Changelog");
  });
});
