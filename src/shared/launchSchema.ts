import { z } from "zod";

export const launchAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional().default(""),
  size: z.coerce.number().min(0),
  text: z.string().optional().default("")
});

export const launchRequestSchema = z.object({
  productBrief: z.string().optional().default(""),
  audience: z.string().min(2, "Audience is required."),
  launchDate: z.string().min(4, "Launch date is required."),
  constraints: z.string().optional().default(""),
  assets: z.string().optional().default(""),
  humanHourlyRate: z.coerce.number().min(0).optional().default(0),
  agentHourlyRate: z.coerce.number().min(0).optional().default(0),
  attachments: z.array(launchAttachmentSchema).optional().default([])
}).superRefine((input, context) => {
  if (input.productBrief.trim().length < 20 && input.attachments.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["productBrief"],
      message: "Add a product brief with at least 20 characters or attach a document."
    });
  }
});

export type LaunchRequest = z.infer<typeof launchRequestSchema>;
export type LaunchAttachment = z.infer<typeof launchAttachmentSchema>;

export type StreamMessage =
  | { type: "status"; message: string; requestId: string }
  | { type: "tool_progress"; tool: string; stage: "started" | "completed"; message: string }
  | { type: "text_delta"; delta: string }
  | { type: "final"; output: string }
  | { type: "error"; message: string };
