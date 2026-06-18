import { tool } from "@openai/agents";
import { z } from "zod";
import type { LaunchRequest } from "../shared/launchSchema";

const launchInput = z.object({
  productBrief: z.string(),
  audience: z.string(),
  launchDate: z.string(),
  constraints: z.string().optional().default(""),
  assets: z.string().optional().default("")
});

const words = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export function extractLaunchTasks(input: LaunchRequest) {
  const text = `${input.productBrief} ${input.constraints} ${input.assets}`;
  const tokens = new Set(words(text));
  const hasDocs = /doc|guide|faq|copy|blog|page|website|landing/i.test(text);
  const hasData = /metric|analytics|dashboard|experiment|cohort|kpi/i.test(text);
  const hasEnablement = /sales|support|success|training|enablement/i.test(text);

  const tasks = [
    {
      priority: "P0",
      phase: "Scope",
      ownerRole: "Product Lead",
      task: "Lock launch narrative, audience promise, non-goals, and success metrics.",
      evidence: tokens.has("metric") || tokens.has("kpi") ? "Metrics are mentioned." : "Metrics need confirmation."
    },
    {
      priority: "P0",
      phase: "Engineering",
      ownerRole: "Engineering Lead",
      task: "Confirm feature freeze, rollback path, monitoring, and operational readiness.",
      evidence: /rollback|monitor|alert|slo|freeze/i.test(text)
        ? "Operational terms are present."
        : "Rollback and monitoring are not explicit."
    },
    {
      priority: "P1",
      phase: "Go-to-market",
      ownerRole: "Marketing",
      task: hasDocs
        ? "Review and adapt existing launch assets for all channels."
        : "Draft launch page, announcement, changelog, and FAQ from the brief.",
      evidence: hasDocs ? "Existing asset signals found." : "No clear launch copy assets listed."
    },
    {
      priority: "P1",
      phase: "Customer readiness",
      ownerRole: hasEnablement ? "Customer Team" : "Support Lead",
      task: "Prepare support macros, internal briefing, escalation path, and known-issues notes.",
      evidence: hasEnablement ? "Enablement audience is mentioned." : "Support readiness needs an owner."
    }
  ];

  if (hasData) {
    tasks.push({
      priority: "P1",
      phase: "Measurement",
      ownerRole: "Data Lead",
      task: "Create launch dashboard with activation, adoption, reliability, and feedback metrics.",
      evidence: "Measurement-related language found."
    });
  }

  return { tasks };
}

export function checkLaunchReadiness(input: LaunchRequest) {
  const fields = [
    { name: "Product brief", ready: input.productBrief.trim().length >= 80 },
    { name: "Audience", ready: input.audience.trim().length >= 8 },
    { name: "Launch date", ready: Boolean(input.launchDate.trim()) },
    { name: "Constraints", ready: input.constraints.trim().length >= 15 },
    { name: "Assets", ready: input.assets.trim().length >= 10 }
  ];
  const score = Math.round((fields.filter((field) => field.ready).length / fields.length) * 100);
  const missing = fields.filter((field) => !field.ready).map((field) => field.name);

  const rubric = [
    { area: "Narrative", status: input.productBrief.length >= 80 ? "green" : "yellow" },
    { area: "Audience fit", status: input.audience.length >= 8 ? "green" : "yellow" },
    { area: "Operational readiness", status: /rollback|monitor|alert|support|incident|slo/i.test(input.constraints) ? "green" : "red" },
    { area: "Asset readiness", status: input.assets.length >= 10 ? "green" : "yellow" }
  ];

  const followUpQuestions = [
    !/metric|kpi|goal|success/i.test(input.productBrief) &&
      "What measurable success metric should the launch optimize for?",
    !/rollback|monitor|alert|incident|slo/i.test(input.constraints) &&
      "What rollback, monitoring, or incident response plan should be assumed?",
    !input.assets.trim() && "Which assets already exist, and which must be created before launch?"
  ].filter(Boolean);

  return { score, rubric, missing, followUpQuestions };
}

export function generateOwnerChecklist(input: LaunchRequest) {
  const tasks = extractLaunchTasks(input).tasks;
  return {
    owners: tasks.map((task) => ({
      ownerRole: task.ownerRole,
      priority: task.priority,
      checklist: [
        `Confirm scope for ${task.phase.toLowerCase()}.`,
        task.task,
        "Post status, blocker, and final sign-off in the launch channel."
      ]
    }))
  };
}

export function draftLaunchCopy(input: LaunchRequest) {
  const conciseBrief = input.productBrief.trim().replace(/\s+/g, " ").slice(0, 220);
  return {
    channels: [
      {
        channel: "In-app banner",
        copy: `New: ${conciseBrief}. Built for ${input.audience}. Learn what changed before ${input.launchDate}.`
      },
      {
        channel: "Changelog",
        copy: `We are launching an update for ${input.audience}: ${conciseBrief}. Availability target: ${input.launchDate}.`
      },
      {
        channel: "Internal launch note",
        copy: `Launch desk brief: ${conciseBrief}. Key constraints: ${input.constraints || "confirm operational constraints"}. Assets: ${input.assets || "confirm required assets"}.`
      }
    ]
  };
}

export const extractLaunchTasksTool = tool({
  name: "extract_launch_tasks",
  description:
    "Extract prioritized launch tasks from the product brief, constraints, assets, audience, and launch date. Use this before writing a plan.",
  parameters: launchInput,
  async execute(input) {
    return extractLaunchTasks(input);
  }
});

export const checkLaunchReadinessTool = tool({
  name: "check_launch_readiness",
  description:
    "Score the launch against a readiness rubric and identify missing details and follow-up questions.",
  parameters: launchInput,
  async execute(input) {
    return checkLaunchReadiness(input);
  }
});

export const generateOwnerChecklistTool = tool({
  name: "generate_owner_checklist",
  description:
    "Generate owner-specific checklists for product, engineering, marketing, support, and data roles.",
  parameters: launchInput,
  async execute(input) {
    return generateOwnerChecklist(input);
  }
});

export const draftLaunchCopyTool = tool({
  name: "draft_channel_launch_copy",
  description:
    "Draft channel-specific launch copy for in-app, changelog, and internal announcement channels.",
  parameters: launchInput,
  async execute(input) {
    return draftLaunchCopy(input);
  }
});

export const launchTools = [
  extractLaunchTasksTool,
  checkLaunchReadinessTool,
  generateOwnerChecklistTool,
  draftLaunchCopyTool
];
