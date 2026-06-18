# Launch Desk

Launch Desk is a full-stack OpenAI Agents SDK app that helps engineering teams turn a rough launch idea into an actionable release plan.

Users enter a product brief, audience, launch date, constraints, and available assets. The backend streams an agent run that produces a prioritized plan, risk register, owner checklist, launch copy suggestions, and follow-up questions.

## Structure

- `src/frontend/` - React/Vite UI for the Launch Desk workspace.
- `src/server/` - Express API routes and SSE streaming helpers.
- `src/agent/` - Launch Desk agent setup, instructions, prompt builder, and runner.
- `src/tools/` - deterministic function tools used by the agent.
- `src/shared/` - shared request and stream schemas.
- `tests/` - local unit tests for tool behavior.
- `scripts/verify-stream.mjs` - end-to-end streamed API verifier.
- `docs/validation-checklist.md` - behavior and extension checklist.

## Setup

Install dependencies:

```powershell
npm install
```

Set `OPENAI_API_KEY` in the environment that starts the backend. On Windows, if the key is stored as a User environment variable, start a fresh shell or pass it into the process:

```powershell
$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
```

Optional model override:

```powershell
$env:LAUNCH_DESK_MODEL = 'gpt-5.5'
```

## Run Locally

Start frontend and backend:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Backend health:

```text
http://127.0.0.1:8787/api/health
```

## GI Config-Service

Launch Desk is registered as a GI local web/API service.

- Service id: `launch-desk-openai`
- Project config: `tools/config-service.json`
- Default config-service URL: `http://127.0.0.1:4100`
- Agent guide: `/agent/guide`
- Agent contract: `/agent/contract`
- API root: `/api`

On backend startup, the server:

1. Reads `tools/config-service.json`.
2. Verifies the config-service health, guide, and contract.
3. Reads `GET /services/launch-desk-openai`.
4. If the record exists, binds only the recorded port.
5. If the record is missing and `selfRegistration` is `on`, chooses a free unregistered port, starts the server, verifies `/api/health`, and writes the record with `PUT /services/launch-desk-openai`.

If config-service is unavailable, the backend exits instead of binding a fallback port.

## Verify

Run unit tests:

```powershell
npm test
```

Run typecheck:

```powershell
npm run typecheck
```

With the backend running and `OPENAI_API_KEY` visible to the backend process, verify real streaming:

```powershell
npm run verify:stream
```

The verifier posts to `/api/launch-plan` and fails unless it receives at least one `tool_progress` event, one `text_delta` event, and a final message.

## Extending Tools

Add a function tool in `src/tools/launchTools.ts` with:

- a clear `name`;
- a task-specific `description`;
- a Zod `parameters` schema;
- a deterministic `execute` function.

Then add it to `launchTools` and update `src/agent/instructions.ts` so the agent knows when to use it.

## Observability

The app uses the Agents SDK runner with tracing enabled by default. Set this to disable local tracing export:

```powershell
$env:LAUNCH_DESK_TRACING_DISABLED = 'true'
```

Each API run includes a generated request id and trace metadata for the launch date and local API surface.
