import type { LaunchRequest } from "../shared/launchSchema";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatAttachments(input: LaunchRequest) {
  if (!input.attachments.length) {
    return "None";
  }

  return input.attachments
    .map((attachment, index) => {
      const text = attachment.text.trim();
      const content = text
        ? `\nExtracted text:\n${text.slice(0, 12000)}${text.length > 12000 ? "\n[Attachment text truncated.]" : ""}`
        : "\nExtracted text: Not available for this file type.";

      return `Attachment ${index + 1}: ${attachment.name} (${attachment.type || "unknown type"}, ${formatBytes(attachment.size)})${content}`;
    })
    .join("\n\n");
}

export function buildLaunchPrompt(input: LaunchRequest) {
  return `
Build a release plan from this launch brief.

Product brief:
${input.productBrief || "Not provided. Use the attached documents as the primary brief."}

Audience:
${input.audience}

Launch date:
${input.launchDate}

Constraints:
${input.constraints || "Not provided"}

Available assets:
${input.assets || "Not provided"}

Attached documents:
${formatAttachments(input)}

Human hourly rate:
${input.humanHourlyRate ? `${input.humanHourlyRate} per hour` : "Not provided"}

Agent hourly rate:
${input.agentHourlyRate ? `${input.agentHourlyRate} per hour` : "Not provided"}

Before finalizing, use the launch planning tools. Then provide a concise but complete plan. For estimates, break work into practical tasks and include human-hours, agent-hours, hybrid development assumptions, calendar timing, and cost where the hourly rate is available. Treat hybrid development as reduced human effort, not human-hours plus agent-hours. Use this default estimate formula unless the brief provides a better one: hybrid human-hours = human-hours * 0.55 + agent-hours * 0.25. Calculate human cost from human-hours and the human hourly rate. Calculate agent cost from agent-hours only when an agent hourly rate is provided. Calculate hybrid cost as hybrid human-hours times the human hourly rate plus agent-hours times the agent hourly rate when provided.
`;
}
