import { describe, expect, it } from "vitest";
import {
  buildCodexLaunchPrompt,
  collectLaunchToolOutputs,
  getLaunchDeskProjectRoot
} from "../src/agent/codexAppRunner";
import { getLaunchDeskRuntime } from "../src/agent/runtime";

const launchInput = {
  productBrief:
    "Launch controlled release scorecards for engineering managers with readiness, blockers, risks, and customer-impact notes before production rollout.",
  audience: "Engineering managers",
  launchDate: "2026-07-15",
  constraints: "Include rollback guidance, monitoring links, and support escalation.",
  assets: "Product spec, dashboard mockups, beta quotes, and draft changelog",
  humanHourlyRate: 2500,
  agentHourlyRate: 300
};

describe("Launch Desk runtime selection", () => {
  it("defaults to the Codex app runtime", () => {
    expect(getLaunchDeskRuntime({})).toBe("codex-app");
  });

  it("keeps the OpenAI Agents SDK path as an explicit opt-in", () => {
    expect(getLaunchDeskRuntime({ LAUNCH_DESK_AGENT_RUNTIME: "openai-agents" })).toBe("openai-agents");
    expect(getLaunchDeskRuntime({ LAUNCH_DESK_AGENT_RUNTIME: "openai" })).toBe("openai-agents");
  });
});

describe("Codex app launch planning prompt", () => {
  it("uses the LaunchDeskOpenAI project root", () => {
    expect(getLaunchDeskProjectRoot().replace(/\\/g, "/")).toMatch(/\/LaunchDeskOpenAI$/);
  });

  it("runs deterministic tool outputs before building the Codex prompt", () => {
    const events: string[] = [];
    const outputs = collectLaunchToolOutputs(launchInput, {
      onToolProgress(tool, stage) {
        events.push(`${tool}:${stage}`);
      }
    });
    const prompt = buildCodexLaunchPrompt(launchInput, outputs);

    expect(events).toContain("extract_launch_tasks:started");
    expect(events).toContain("draft_channel_launch_copy:completed");
    expect(prompt).toContain("Local deterministic tool outputs");
    expect(prompt).toContain("Risk register");
    expect(prompt).toContain("TASK_CARDS_JSON");
    expect(prompt).toContain("titleRu");
    expect(prompt).toContain("agentHours");
    expect(prompt).toContain("2500 per hour");
    expect(prompt).toContain("300 per hour");
    expect(prompt).toContain("Use this humanHours rubric");
    expect(prompt).toContain("estimateBasisRu");
    expect(prompt).toContain("Engineering Lead");
  });
});
