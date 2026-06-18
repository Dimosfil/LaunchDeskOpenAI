import { Agent, Runner } from "@openai/agents";
import { launchDeskInstructions } from "./instructions";
import { getLaunchDeskModel } from "./runtime";
import { launchTools } from "../tools/launchTools";

export const launchDeskModel = getLaunchDeskModel();

export const launchDeskAgent = new Agent({
  name: "Launch Desk",
  model: launchDeskModel,
  instructions: launchDeskInstructions,
  tools: launchTools
});

export const runner = new Runner({
  tracingDisabled: process.env.LAUNCH_DESK_TRACING_DISABLED === "true",
  traceIncludeSensitiveData: false,
  workflowName: "Launch Desk"
});
