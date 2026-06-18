import { z } from "zod";

export const launchRequestSchema = z.object({
  productBrief: z.string().min(20, "Add a product brief with at least 20 characters."),
  audience: z.string().min(2, "Audience is required."),
  launchDate: z.string().min(4, "Launch date is required."),
  constraints: z.string().optional().default(""),
  assets: z.string().optional().default("")
});

export type LaunchRequest = z.infer<typeof launchRequestSchema>;

export type StreamMessage =
  | { type: "status"; message: string; requestId: string }
  | { type: "tool_progress"; tool: string; stage: "started" | "completed"; message: string }
  | { type: "text_delta"; delta: string }
  | { type: "final"; output: string }
  | { type: "error"; message: string };
