import type { LaunchRequest } from "../shared/launchSchema";

export function buildLaunchPrompt(input: LaunchRequest) {
  return `
Build a release plan from this launch brief.

Product brief:
${input.productBrief}

Audience:
${input.audience}

Launch date:
${input.launchDate}

Constraints:
${input.constraints || "Not provided"}

Available assets:
${input.assets || "Not provided"}

Before finalizing, use the launch planning tools. Then provide a concise but complete plan.
`;
}
