export type LaunchDeskAgentRuntime = "codex-app" | "openai-agents";

const runtimeAliases: Record<string, LaunchDeskAgentRuntime> = {
  codex: "codex-app",
  "codex-app": "codex-app",
  "codex_app": "codex-app",
  openai: "openai-agents",
  "openai-agents": "openai-agents",
  "openai_agents": "openai-agents",
  agents: "openai-agents"
};

export function getLaunchDeskRuntime(env: NodeJS.ProcessEnv = process.env): LaunchDeskAgentRuntime {
  const configured = (env.LAUNCH_DESK_AGENT_RUNTIME || env.LAUNCH_DESK_RUNTIME || "codex-app")
    .trim()
    .toLowerCase();
  return runtimeAliases[configured] || "codex-app";
}

export function getLaunchDeskModel(env: NodeJS.ProcessEnv = process.env) {
  return env.LAUNCH_DESK_MODEL || "gpt-5.5";
}
