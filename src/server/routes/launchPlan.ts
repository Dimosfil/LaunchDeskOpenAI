import { Router } from "express";
import { randomUUID } from "node:crypto";
import { runLaunchPlanWithCodexApp } from "../../agent/codexAppRunner";
import { buildLaunchPrompt } from "../../agent/prompt";
import { getLaunchDeskModel, getLaunchDeskRuntime } from "../../agent/runtime";
import { launchRequestSchema } from "../../shared/launchSchema";
import { configureSse, sendSse } from "../sse";

export const launchPlanRouter = Router();

function toolNameFromEvent(event: unknown) {
  const candidate = event as {
    item?: { type?: string; rawItem?: { name?: string }; name?: string };
    name?: string;
  };
  return candidate.item?.rawItem?.name || candidate.item?.name || candidate.name || "agent_tool";
}

function modelDeltaFromEvent(event: unknown) {
  const data = (event as { data?: { type?: string; delta?: unknown; text?: unknown } }).data;
  if (!data) {
    return "";
  }
  if (typeof data.delta === "string" && /delta|text/i.test(data.type || "")) {
    return data.delta;
  }
  if (typeof data.text === "string" && /delta|text/i.test(data.type || "")) {
    return data.text;
  }
  return "";
}

launchPlanRouter.post("/launch-plan", async (req, res) => {
  configureSse(res);
  const requestId = randomUUID();

  try {
    const input = launchRequestSchema.parse(req.body);
    const runtime = getLaunchDeskRuntime();
    sendSse(res, {
      type: "status",
      requestId,
      message: `Starting Launch Desk run through ${runtime} with model ${getLaunchDeskModel()}.`
    });

    if (runtime === "codex-app") {
      const output = await runLaunchPlanWithCodexApp(input, {
        onStatus(message) {
          sendSse(res, { type: "status", requestId, message });
        },
        onToolProgress(tool, stage, message) {
          sendSse(res, { type: "tool_progress", tool, stage, message });
        },
        onTextDelta(delta) {
          sendSse(res, { type: "text_delta", delta });
        }
      });
      sendSse(res, { type: "final", output });
      res.end();
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required only when LAUNCH_DESK_AGENT_RUNTIME=openai-agents.");
    }

    const { launchDeskAgent, runner } = await import("../../agent/launchDeskAgent");
    const stream = await runner.run(launchDeskAgent, buildLaunchPrompt(input), {
      stream: true,
      maxTurns: 10
    });
    for await (const event of stream) {
      if (event.type === "run_item_stream_event") {
        const itemType = (event.item as { type?: string }).type || "";
        if (/tool/i.test(itemType)) {
          sendSse(res, {
            type: "tool_progress",
            tool: toolNameFromEvent(event),
            stage: /output|result/i.test(itemType) ? "completed" : "started",
            message: itemType
          });
        }
      }

      if (event.type === "raw_model_stream_event") {
        const delta = modelDeltaFromEvent(event);
        if (delta) {
          sendSse(res, { type: "text_delta", delta });
        }
      }
    }

    await stream.completed;
    sendSse(res, { type: "final", output: stream.finalOutput ?? "" });
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Launch Desk error.";
    sendSse(res, { type: "error", message });
    res.end();
  }
});
