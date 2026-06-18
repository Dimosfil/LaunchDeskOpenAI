import { Router } from "express";
import { launchDeskModel } from "../../agent/launchDeskAgent";
import { serviceCapabilities, serviceId, serviceName, servicePaths } from "../serviceMetadata";

export const agentInfoRouter = Router();

agentInfoRouter.get("/agent/guide", (_req, res) => {
  res.json({
    service: serviceId,
    name: serviceName,
    purpose:
      "Agent-facing Launch Desk service that turns launch briefs into actionable release plans.",
    workflow: [
      "Check GET /api/health before using the planning API.",
      "Read GET /agent/contract before sending launch planning requests.",
      "Send POST /api/launch-plan with productBrief, audience, launchDate, constraints, and assets.",
      "Read the text/event-stream response until a final event or an error event is received."
    ],
    privacy: [
      "Do not send secrets, credentials, customer private data, or production incident details unless explicitly approved.",
      "Launch brief content is sent to the configured OpenAI model from the server process."
    ],
    endpoints: {
      health: servicePaths.health,
      guide: servicePaths.guide,
      contract: servicePaths.contract,
      api: servicePaths.api,
      launchPlan: "/api/launch-plan"
    },
    capabilities: serviceCapabilities,
    model: launchDeskModel
  });
});

agentInfoRouter.get("/agent/contract", (_req, res) => {
  res.json({
    service: serviceId,
    version: 1,
    contentType: "application/json",
    streamContentType: "text/event-stream",
    operations: [
      {
        method: "GET",
        path: "/api/health",
        description: "Check service readiness and whether OPENAI_API_KEY is visible to the backend."
      },
      {
        method: "GET",
        path: "/agent/guide",
        description: "Read agent onboarding guidance for Launch Desk."
      },
      {
        method: "GET",
        path: "/agent/contract",
        description: "Read the strict operation contract for Launch Desk."
      },
      {
        method: "POST",
        path: "/api/launch-plan",
        description: "Run the Launch Desk agent and stream progress and text deltas.",
        request: {
          contentType: "application/json",
          required: ["productBrief", "audience", "launchDate"],
          optional: ["constraints", "assets"],
          schema: {
            productBrief: "string, minimum 20 characters",
            audience: "string",
            launchDate: "string",
            constraints: "string",
            assets: "string"
          }
        },
        response: {
          contentType: "text/event-stream",
          events: ["status", "tool_progress", "text_delta", "final", "error"]
        }
      }
    ],
    schemas: {
      streamEvent: {
        status: ["type", "message", "requestId"],
        tool_progress: ["type", "tool", "stage", "message"],
        text_delta: ["type", "delta"],
        final: ["type", "output"],
        error: ["type", "message"]
      }
    }
  });
});
