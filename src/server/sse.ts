import type { Response } from "express";
import type { StreamMessage } from "../shared/launchSchema";

export function configureSse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

export function sendSse(res: Response, event: StreamMessage) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
