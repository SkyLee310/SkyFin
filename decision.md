# Decisions — SkyFin

See full decision details in [docs/decision.md](./docs/decision.md) and [docs/PRD.md §6](./docs/PRD.md).

### Summary of Latest Decisions
- **D21 (2026-09-21): Milestone Ownership & Parallel Agent Worktrees**
  - **M1 Owner:** Claude (working in root repository on branch `m1`).
  - **M2 Owner:** Antigravity (working in isolated worktree `.worktrees/m2` on branch `m2`).
  - Integration will be performed by merging `m1` into `m2` once M1 passes the real iPhone demo.
- **D22 (2026-09-21): Gemini through Vertex AI**
  - Service-account key (Vertex AI User role only), stored base64-encoded in the server-only env var `GOOGLE_SERVICE_ACCOUNT_KEY`; replaces the AI Studio `GEMINI_API_KEY`.
