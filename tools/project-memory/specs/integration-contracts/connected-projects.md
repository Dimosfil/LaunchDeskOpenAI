# Connected Projects

This register lists external projects, repositories, services, libraries, docs
sites, upstream tools, cloned examples, and sibling workspaces that this project
depends on, researches, vendors, or regularly interacts with.

Agents should read this file before touching integrations, nested repositories,
cloned examples, external project folders, or cross-project service contracts.
Do not treat an entry here as permission to inspect arbitrary files; follow the
project scope, privacy rules, and explicit user request.

## Entry Template

### Project Name

- Purpose:
- Business or architectural role:
- Local folder:
- Canonical Git/package/docs URLs:
- Service ID or runtime endpoints:
- Owner or source of truth:
- Data/API contract:
- Setup, sync, build, test, or update commands:
- Version, branch, or update cadence:
- Privacy, secret, license, and access boundaries:
- Status and caveats:
- Reason this dependency still exists:

### GI Config Service

- Purpose: Bootstrap discovery for local agent-facing service URLs.
- Business or architectural role: Launch Desk registers itself as a local web/API service and resolves its startup port through this registry.
- Local folder: `D:/AI/config-service`
- Canonical Git/package/docs URLs: project-local service exposed through GI main config.
- Service ID or runtime endpoints: `config-service`, `http://127.0.0.1:4100`, guide `/agent/guide`, contract `/agent/contract`, API `/services`.
- Owner or source of truth: GI main config at `D:/AI/general-instructions/config/gi-main.json` and the live service contract.
- Data/API contract: `GET /health`, `GET /agent/guide`, `GET /agent/contract`, `GET /services`, `GET /services/{serviceId}`, `PUT /services/{serviceId}`.
- Setup, sync, build, test, or update commands: use the service startup record from config-service; do not guess ports or scan sibling projects.
- Version, branch, or update cadence: contract version 1 as observed on 2026-06-18.
- Privacy, secret, license, and access boundaries: store discovery metadata only; no secrets, credentials, cookies, private production data, or workflow state.
- Status and caveats: required for Launch Desk backend startup. If unavailable, Launch Desk must not bind a fallback port.
- Reason this dependency still exists: GI rules require web/API apps to use config-service for runtime service discovery and self-registration.
