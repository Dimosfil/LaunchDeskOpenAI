import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLaunchPrompt } from "./prompt";
import { getLaunchDeskModel } from "./runtime";
import type { LaunchRequest } from "../shared/launchSchema";
import {
  checkLaunchReadiness,
  draftLaunchCopy,
  extractLaunchTasks,
  generateOwnerChecklist
} from "../tools/launchTools";

type JsonMessage = Record<string, unknown>;
type ToolStage = "started" | "completed";

export type CodexRunCallbacks = {
  onStatus?: (message: string) => void;
  onToolProgress?: (tool: string, stage: ToolStage, message: string) => void;
  onTextDelta?: (delta: string) => void;
};

type QueueWaiter = {
  resolve: (message: JsonMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function getLaunchDeskProjectRoot() {
  return PROJECT_ROOT;
}

function resolveCodexCommand(env: NodeJS.ProcessEnv = process.env) {
  if (env.CODEX_COMMAND?.trim()) {
    return env.CODEX_COMMAND.trim();
  }

  if (process.platform === "win32") {
    const userCodex = path.join(env.USERPROFILE || homedir(), ".codex", "bin", "codex.cmd");
    if (existsSync(userCodex)) {
      return userCodex;
    }

    const pathEntries = (env.Path || env.PATH || "").split(path.delimiter).filter(Boolean);
    const preferred = pathEntries
      .map((entry) => path.join(entry, "codex.cmd"))
      .find((candidate) => existsSync(candidate) && !/(\\WindowsApps\\|\\System32\\)/i.test(candidate));
    if (preferred) {
      return preferred;
    }
    return "codex.cmd";
  }

  return "codex";
}

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class MessageQueue {
  private messages: JsonMessage[] = [];
  private waiters: QueueWaiter[] = [];
  private failed: Error | null = null;

  push(message: JsonMessage) {
    const waiter = this.waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(message);
      return;
    }
    this.messages.push(message);
  }

  fail(error: Error) {
    this.failed = error;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  next(timeoutMs: number, context: string) {
    if (this.messages.length > 0) {
      return Promise.resolve(this.messages.shift() as JsonMessage);
    }
    if (this.failed) {
      return Promise.reject(this.failed);
    }
    return new Promise<JsonMessage>((resolve, reject) => {
      const waiter: QueueWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
          reject(new Error(`Timed out while waiting for ${context}.`));
        }, timeoutMs)
      };
      this.waiters.push(waiter);
    });
  }
}

class CodexAppServer {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly queue = new MessageQueue();
  private readonly stderrLines: string[] = [];
  private stdoutBuffer = "";

  constructor(
    private readonly root: string,
    private readonly command = resolveCodexCommand(),
    private readonly requestTimeoutMs = numberFromEnv("LAUNCH_DESK_CODEX_REQUEST_TIMEOUT_SECONDS", 30) * 1000,
    private readonly turnTimeoutMs = numberFromEnv("LAUNCH_DESK_CODEX_TURN_TIMEOUT_SECONDS", 180) * 1000
  ) {}

  async start() {
    this.process = spawn(this.command, ["app-server"], {
      cwd: this.root,
      shell: process.platform === "win32",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", (chunk: string) => this.readStdout(chunk));
    this.process.stderr.on("data", (chunk: string) => this.readStderr(chunk));
    this.process.once("error", (error) => this.queue.fail(error));
    this.process.once("close", (code) => {
      this.queue.fail(new Error(`Codex app-server exited with code ${code}.${this.stderrTail()}`));
    });

    await this.request("initialize", {
      clientInfo: {
        name: "launch_desk_codex_app",
        title: "Launch Desk Codex App Runtime",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        optOutNotificationMethods: [
          "command/exec/outputDelta",
          "item/plan/delta",
          "item/fileChange/outputDelta",
          "item/reasoning/summaryTextDelta",
          "item/reasoning/textDelta"
        ]
      }
    });
    this.notify("initialized", {});
  }

  stop() {
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }

  async startThread(model: string) {
    const result = await this.request("thread/start", {
      model,
      modelProvider: null,
      cwd: this.root,
      runtimeWorkspaceRoots: [this.root],
      approvalPolicy: null,
      approvalsReviewer: null,
      sandbox: null,
      permissions: null,
      config: null,
      serviceName: null,
      baseInstructions: null,
      developerInstructions:
        "You are Launch Desk, a launch planning assistant. Answer in chat only. Do not edit files, inspect files, run shell commands, or ask for approvals.",
      personality: null,
      ephemeral: true,
      sessionStartSource: null,
      threadSource: null,
      environments: null,
      dynamicTools: null,
      selectedCapabilityRoots: null,
      mockExperimentalField: null
    });
    const thread = (result as { thread?: { id?: string } }).thread;
    if (!thread?.id) {
      throw new Error("Codex app-server did not return a thread id.");
    }
    return thread.id;
  }

  async runTurn(threadId: string, prompt: string, callbacks: CodexRunCallbacks) {
    const result = await this.request("turn/start", {
      threadId,
      clientUserMessageId: randomUUID(),
      input: [{ type: "text", text: prompt, text_elements: [] }],
      responsesapiClientMetadata: null,
      additionalContext: null,
      environments: null,
      cwd: this.root,
      runtimeWorkspaceRoots: [this.root],
      approvalPolicy: null,
      approvalsReviewer: null,
      sandboxPolicy: null,
      permissions: null,
      model: null,
      effort: "high",
      summary: null,
      personality: null,
      outputSchema: null,
      collaborationMode: null
    });
    const turnId = (result as { turn?: { id?: string } }).turn?.id;
    return this.collectFinalResponse(turnId, callbacks);
  }

  private readStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        this.queue.push(JSON.parse(line) as JsonMessage);
      } catch {
        this.readStderr(line);
      }
    }
  }

  private readStderr(chunk: string) {
    for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
      this.stderrLines.push(line);
      if (this.stderrLines.length > 80) {
        this.stderrLines.shift();
      }
    }
  }

  private stderrTail() {
    return this.stderrLines.length > 0 ? ` Stderr: ${this.stderrLines.join("\n")}` : "";
  }

  private send(message: JsonMessage) {
    if (!this.process?.stdin.writable) {
      throw new Error("Codex app-server is not running.");
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private notify(method: string, params: JsonMessage) {
    this.send({ method, params });
  }

  private async request(method: string, params: JsonMessage) {
    const id = this.nextId++;
    this.send({ method, id, params });
    while (true) {
      const message = await this.queue.next(this.requestTimeoutMs, `Codex response ${id}`);
      if (message.id !== id) {
        continue;
      }
      if (message.error) {
        throw new Error(`Codex request failed: ${JSON.stringify(message.error)}`);
      }
      return message.result as JsonMessage;
    }
  }

  private async collectFinalResponse(turnId: string | undefined, callbacks: CodexRunCallbacks) {
    let streamed = "";
    let completedText = "";

    while (true) {
      const message = await this.queue.next(this.turnTimeoutMs, "Codex turn completion");
      const method = typeof message.method === "string" ? message.method : "";
      const params = (message.params || {}) as Record<string, unknown>;

      if (method === "item/agentMessage/delta") {
        const delta = typeof params.delta === "string" ? params.delta : typeof params.text === "string" ? params.text : "";
        if (delta) {
          streamed += delta;
          callbacks.onTextDelta?.(delta);
        }
      }

      if (method === "item/completed") {
        const item = (params.item || {}) as { type?: string; text?: string };
        if (item.type === "agentMessage" && typeof item.text === "string") {
          completedText = item.text;
        }
      }

      if (method === "turn/completed") {
        const completedTurn = (params.turn || {}) as { id?: string };
        if (!turnId || completedTurn.id === turnId) {
          const output = (completedText || streamed).trim();
          if (!streamed && output) {
            callbacks.onTextDelta?.(output);
          }
          return output;
        }
      }
    }
  }
}

export function collectLaunchToolOutputs(input: LaunchRequest, callbacks: CodexRunCallbacks = {}) {
  const steps = [
    ["extract_launch_tasks", () => extractLaunchTasks(input)],
    ["check_launch_readiness", () => checkLaunchReadiness(input)],
    ["generate_owner_checklist", () => generateOwnerChecklist(input)],
    ["draft_channel_launch_copy", () => draftLaunchCopy(input)]
  ] as const;

  return Object.fromEntries(
    steps.map(([name, run]) => {
      callbacks.onToolProgress?.(name, "started", "Running local deterministic launch tool.");
      const output = run();
      callbacks.onToolProgress?.(name, "completed", "Local deterministic launch tool completed.");
      return [name, output];
    })
  );
}

export function buildCodexLaunchPrompt(input: LaunchRequest, toolOutputs: Record<string, unknown>) {
  return `${buildLaunchPrompt(input)}

Local deterministic tool outputs:
${JSON.stringify(toolOutputs, null, 2)}

Use the tool outputs as evidence. Return a concise release plan with these sections:
1. Priority plan
2. Risk register
3. Owner checklist
4. Launch copy
5. Follow-up questions
`;
}

export async function runLaunchPlanWithCodexApp(input: LaunchRequest, callbacks: CodexRunCallbacks = {}) {
  const root = getLaunchDeskProjectRoot();
  const model = getLaunchDeskModel();
  callbacks.onStatus?.(`Starting Codex app runtime with model ${model}.`);
  callbacks.onStatus?.(`Workspace: ${root}`);

  const toolOutputs = collectLaunchToolOutputs(input, callbacks);
  const prompt = buildCodexLaunchPrompt(input, toolOutputs);
  const server = new CodexAppServer(root);

  try {
    callbacks.onStatus?.("Starting local Codex app-server.");
    await server.start();
    const threadId = await server.startThread(model);
    callbacks.onStatus?.("Codex thread is ready. Streaming launch plan.");
    return await server.runTurn(threadId, prompt, callbacks);
  } finally {
    server.stop();
  }
}
