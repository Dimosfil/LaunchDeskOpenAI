# Original Project Prompt

Build a working launch-planning agent app called "Launch Desk" using the current OpenAI Agents SDK.

The app should help an engineering team turn a rough launch idea into an actionable release plan. Users should enter a product brief, audience, launch date, constraints, and available assets in a frontend UI. The agent should respond with a prioritized plan, risk register, owner checklist, launch copy suggestions, and follow-up questions when key details are missing.

Requirements:
- Build a polished frontend for interacting with the agent. Do not make this a CLI-only tool.
- Build the agent with clear instructions and a project structure that separates frontend UI, server/API routes, agent setup, tools, and tests.
- Include useful tool patterns, such as extracting tasks from the brief, checking launch readiness against a rubric, generating owner checklists, and drafting channel-specific launch copy.
- Include streaming or progressive response updates, and verify them end-to-end by posting to the local API route and reading the stream until at least one tool progress event and one model text delta are received.
- Include tracing or observability hooks if idiomatic.
- Include OPENAI_API_KEY environment variable setup and local setup instructions.
- Make it easy for a developer to understand, run, test, and extend with new tools or handoffs.
- Add a README and a validation checklist for the agent behavior, frontend flow, and tool outputs.
- Use current OpenAI API and Agents SDK patterns. Do not use deprecated Assistants API or legacy Chat Completions scaffolding unless you explicitly explain why a compatibility shim is needed.

Local run and verification requirement:
After implementing, start the frontend and backend dev servers in a way that can actually reach the OpenAI API from the server process. If the environment uses sandboxed command execution, do not assume localhost success means OpenAI API access works. Verify the agent endpoint with a real streamed POST request to the local API and confirm that it emits at least one tool event and one model text delta. If the server cannot reach the OpenAI API, diagnose and fix the server run mode or clearly report the exact blocker.

Do not finish after only checking `/api/health`, Vite startup, TypeScript, or unit tests. The final verification must include an end-to-end agent call through the frontend/API route using the configured `OPENAI_API_KEY`.

Documentation:
- If the OpenAI Docs skill is available, use it to verify the latest OpenAI API guidance before implementing.
- If the OpenAI Docs skill is not available, install the OpenAI Docs skill and use it.
- If the OpenAI Docs skill cannot be installed or used, use web search to search the latest OpenAI developer documentation on developers.openai.com/api.
- Reference https://developers.openai.com/api/docs/models for guidance on the latest models to use.

Frontend:
- If the Frontend skill is installed, use it for frontend implementation and polish.
- If the Frontend skill is not installed, install the Frontend skill and use it.
