export const serviceId = "launch-desk-openai";
export const serviceName = "Launch Desk OpenAI";

export const servicePaths = {
  health: "/api/health",
  availability: "/api/health",
  guide: "/agent/guide",
  contract: "/agent/contract",
  api: "/api"
};

export const serviceCapabilities = [
  "launch-planning-agent",
  "codex-app-runtime",
  "openai-agents-sdk",
  "sse-streaming",
  "agent-guide",
  "agent-contract"
];

export function buildServiceRecord(port: number) {
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    name: serviceName,
    kind: "local-app",
    health: servicePaths.health,
    availability: servicePaths.availability,
    guide: servicePaths.guide,
    contract: servicePaths.contract,
    api: servicePaths.api,
    capabilities: serviceCapabilities,
    startup: {
      cwd: process.cwd().replace(/\\/g, "/"),
      command: "npm run dev:server"
    },
    apiVersion: "v1",
    notes:
      "Local Launch Desk app: React/Vite frontend plus Express API. Default planning runtime uses signed-in Codex app-server; OpenAI Agents SDK is opt-in. Discovery metadata only; no secrets."
  };
}
