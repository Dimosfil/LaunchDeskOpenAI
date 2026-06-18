# Pending Tasks

Use this file for active project-wide plans and multi-step work.

Keep entries concise and task-relevant. Do not store full diffs, large logs,
generated outputs, secrets, credentials, or private production data.

## Status Markers

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked or needs attention

## Tasks

### 2026-06-18 GI Config-Service Registration

Goal: Make Launch Desk a GI config-service registered local web/API service.

Planned changes:

- [x] Add project-local config-service settings with self-registration enabled.
- [x] Add service guide and contract endpoints.
- [x] Require live config-service lookup before backend binds a port.
- [x] Register or refresh the service record through config-service contract.
- [x] Document the workflow and verify locally.

Execution order:

- [x] Read local GI config-service rules and live config-service contract.
- [x] Implement startup lookup and registration.
- [x] Run typecheck/tests.
- [x] Start backend and verify config-service record.

Risks or dependencies:

- [x] Config-service URL is configured in GI main config as `http://127.0.0.1:4100`.
- [x] Service must not bind fallback ports while config-service is unavailable.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `GET /services/launch-desk-openai` returns the registered Launch Desk record.

### 2026-06-18 Launch Desk Agents SDK App

Goal: Build a working frontend-backed OpenAI Agents SDK app for launch planning.

Planned changes:

- [x] Create React/Vite frontend and Express API server.
- [x] Add Launch Desk agent instructions, function tools, and streaming route.
- [x] Add tests, README, and validation checklist.
- [!] Run typecheck, tests, start dev servers, and verify a real streamed agent call.

Execution order:

- [x] Confirm OpenAI API key availability without exposing the value.
- [x] Check current OpenAI Agents SDK docs and model guidance.
- [x] Scaffold app files and dependencies.
- [!] Verify local API streaming includes tool progress and model text deltas.

Risks or dependencies:

- [x] `OPENAI_API_KEY` is available in User environment, not the current Codex process; server startup passed it through safely.
- [!] OpenAI API reached successfully, but the key returned `quota exceeded`, blocking the required real streamed agent verification.

Verification:

- [x] `npm run typecheck`
- [x] `npm test`
- [!] `npm run verify:stream` against a running local backend: blocked by OpenAI API quota exceeded.

### TODO Task Name

Goal: TODO

Planned changes:

- [ ] TODO

Execution order:

- [ ] TODO

Risks or dependencies:

- [ ] TODO

Verification:

- [ ] TODO
