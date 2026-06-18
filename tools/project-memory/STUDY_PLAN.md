# Study Plan

Use this plan to map the project gradually. Do not try to load the whole
repository into context at once.

## First Pass

- [x] Identify entry points.
- [x] Identify main modules/packages.
- [x] Find run, test, build, and log commands.
- [x] Locate config and secret boundaries.
- [x] Locate tests and automation.

## Architecture Map

- [x] Runtime lifecycle.
- [x] Data flow.
- [x] External APIs or services.
- [x] Persistence/storage.
- [x] UI routes, screens, or scenes.
- [x] Asset/template generation.

## Quality Gates

- [x] Fast syntax or type check.
- [x] Unit tests.
- [ ] Integration or smoke test.
- [ ] Build/package command.
- [ ] Log inspection command.

## Notes To Write

- [ ] `architecture.md`
- [ ] `decisions.md`
- [ ] `known-issues.md`

## 2026-06-18 Study Notes

- Entry points: `src/server/index.ts` for the Express API, `src/frontend/main.tsx` for the React UI, `src/agent/runtime.ts` for runtime selection, `src/agent/codexAppRunner.ts` for the default Codex app runtime, and `src/agent/launchDeskAgent.ts` for the optional Agents SDK runtime.
- Data flow: the frontend posts the launch form to `/api/launch-plan`; the backend validates with `launchRequestSchema`, runs the Launch Desk agent with streamed output, and emits SSE messages for status, tool progress, text deltas, final output, and errors. The default Codex prompt appends `TASK_CARDS_JSON`; `src/shared/taskCards.ts` parses it for the frontend Tasks tab.
- Tool layer: `src/tools/launchTools.ts` provides deterministic launch task extraction, readiness scoring, owner checklists, and launch copy drafting; `tests/launchTools.test.ts` covers the core tool behavior.
- Runtime config: `LAUNCH_DESK_AGENT_RUNTIME` defaults to `codex-app`, which starts `codex app-server` from the `LaunchDeskOpenAI` project folder and uses local Codex app/CLI auth instead of `OPENAI_API_KEY`. Set `LAUNCH_DESK_AGENT_RUNTIME=openai-agents` to use the OpenAI Agents SDK path, where `OPENAI_API_KEY` is required. `LAUNCH_DESK_MODEL` overrides the default model, `LAUNCH_DESK_TRACING_DISABLED=true` disables tracing export for the SDK path, and `tools/config-service.json` currently enables local config-service self-registration for `launch-desk-openai`.
- Verification completed during study: `npm run typecheck`, `npm test`, and `npm run verify:stream` passed with the default `codex-app` runtime. The optional OpenAI Agents SDK path still depends on a usable `OPENAI_API_KEY`.
