import express from "express";
import cors from "cors";
import http from "node:http";
import { agentInfoRouter } from "./routes/agentInfo";
import { launchPlanRouter } from "./routes/launchPlan";
import { registerService, resolveStartupDecision } from "./configService";
import { getLaunchDeskModel, getLaunchDeskRuntime } from "../agent/runtime";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "8mb" }));
app.use(agentInfoRouter);

app.get("/api/health", (_req, res) => {
  const runtime = getLaunchDeskRuntime();
  res.json({
    ok: true,
    app: "Launch Desk",
    runtime,
    model: getLaunchDeskModel(),
    apiKeyConfigured: runtime === "openai-agents" && Boolean(process.env.OPENAI_API_KEY),
    apiKeyRequired: runtime === "openai-agents",
    openAiAgentsApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.use("/api", launchPlanRouter);

async function verifyLocalHealth(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  if (!response.ok) {
    throw new Error(`Local health check failed with HTTP ${response.status}.`);
  }
}

function listen(port: number) {
  const server = http.createServer(app);
  return new Promise<http.Server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function start() {
  const startup = await resolveStartupDecision();
  const server = await listen(startup.port);
  try {
    await verifyLocalHealth(startup.port);
    if (startup.shouldRegister) {
      await registerService(startup.configServiceUrl, startup.port);
    }
    console.log(
      `Launch Desk API listening on http://127.0.0.1:${startup.port} (${startup.reason})`
    );
  } catch (error) {
    server.close();
    throw error;
  }
}

start().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
