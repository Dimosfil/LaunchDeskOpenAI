# Technology Stack

Last reviewed: 2026-06-21

## Summary

- Primary stack: TypeScript, React, Vite, Express.
- Runtime model: web UI plus Node/Express backend.
- Current confidence: partial; manifest-derived.

## Components

| Layer | Technology | Evidence | Notes |
| --- | --- | --- | --- |
| Frontend | TypeScript, React, Vite | `package.json`, `tsconfig.json`, `vite.config.*` | Manifest-derived. |
| Backend/API | Express | `package.json` dependencies | Manifest-derived. |
| Package management | npm-compatible Node tooling | `package.json` | Confirm lockfile and scripts before install. |
| GI/project memory | General Instructions kit | `tools/project-memory/instruction-kit.json`, `AGENTS.md` | GI is installed. |

## Commands

| Purpose | Command | Evidence |
| --- | --- | --- |
| Install | TODO | Confirm package manager |
| Run | TODO | Confirm `package.json` scripts |
| Test | TODO | Confirm `package.json` scripts |
| Build | TODO | Vite present |

## External Services

| Service | Role | Evidence | Boundary |
| --- | --- | --- | --- |
| OpenAI API | Likely AI provider | Project name | Keep API keys in environment/config, never in project memory. |

## Gaps

- Confirm OpenAI integration surface, server ports, and build/start scripts.
