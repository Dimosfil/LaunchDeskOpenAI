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

- Entry points: `src/server/index.ts` for the Express API, `src/frontend/main.tsx` for the React UI, and `src/agent/launchDeskAgent.ts` for the Agents SDK runtime.
- Data flow: the frontend posts the launch form to `/api/launch-plan`; the backend validates with `launchRequestSchema`, runs the Launch Desk agent with streamed output, and emits SSE messages for status, tool progress, text deltas, final output, and errors.
- Tool layer: `src/tools/launchTools.ts` provides deterministic launch task extraction, readiness scoring, owner checklists, and launch copy drafting; `tests/launchTools.test.ts` covers the core tool behavior.
- Runtime config: `OPENAI_API_KEY` is required for real agent runs, `LAUNCH_DESK_MODEL` overrides the default model, `LAUNCH_DESK_TRACING_DISABLED=true` disables tracing export, and `tools/config-service.json` currently enables local config-service self-registration for `launch-desk-openai`.
- Verification completed during study: `npm run typecheck` and `npm test` passed. Real streamed verification was not run because it requires a running backend and usable OpenAI quota.
