# Launch Desk Validation Checklist

## Agent Behavior

- [ ] Calls launch task extraction before final planning.
- [ ] Calls readiness rubric before final planning.
- [ ] Calls owner checklist generation before final planning.
- [ ] Calls launch copy drafting before final planning.
- [ ] Produces sections for prioritized plan, risk register, owner checklist, launch copy suggestions, and follow-up questions.
- [ ] Asks follow-up questions when metrics, rollback, monitoring, assets, or ownership details are missing.
- [ ] Keeps launch recommendations grounded in the submitted brief, audience, launch date, constraints, and assets.

## Frontend Flow

- [ ] User can edit product brief, audience, launch date, constraints, and assets.
- [ ] Submit button starts a streamed run without a page reload.
- [ ] Tool progress events appear while the run is active.
- [ ] Model text deltas progressively populate the output area.
- [ ] API errors appear in the UI without clearing the user's form input.
- [ ] Layout remains usable on desktop and mobile viewport widths.

## Tool Outputs

- [ ] `extract_launch_tasks` returns prioritized tasks with phase, owner role, task, and evidence.
- [ ] `check_launch_readiness` returns score, rubric, missing fields, and follow-up questions.
- [ ] `generate_owner_checklist` returns owner-specific checklist items.
- [ ] `draft_channel_launch_copy` returns channel-specific copy for in-app, changelog, and internal channels.

## Local Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Backend process sees `OPENAI_API_KEY`.
- [ ] `npm run verify:stream` receives at least one `tool_progress`, one `text_delta`, and one `final` event.
