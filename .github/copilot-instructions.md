<!-- GSD Configuration — managed by get-shit-done installer -->
# Instructions for GSD

- Use the get-shit-done skill when the user asks for GSD or uses a `gsd-*` command.
- Treat `/gsd-...` or `gsd-...` as command invocations and load the matching file from `.github/skills/gsd-*`.
- When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`.
- Do not apply GSD workflows unless the user explicitly asks for them.
- After completing any `gsd-*` command (or any deliverable it triggers: feature, bug fix, tests, docs, etc.), ALWAYS: (1) offer the user the next step by prompting via `ask_user`; repeat this feedback loop until the user explicitly indicates they are done.
<!-- /GSD Configuration -->

# Project Context

This repository is AHP Inspector: a local-first developer GUI for discovering, watching, searching, and understanding JSONL logs of Agent Host Protocol traffic. The core value is to make AHP traffic understandable at a glance while preserving fast access to exact raw event details.

The first milestone builds a standalone local web app launched from the CLI. Keep architecture compatible with a future VS Code extension/webview by preserving a host adapter boundary between file discovery/watching/reading and the portable browser UI.

# Protocol Reference

Use `../agent-host-protocol` as the source of truth for AHP concepts, method names, action/notification types, and schemas. Do not invent protocol definitions when the sibling repository contains the canonical TypeScript types or generated JSON schemas.

# Current Plan

Planning artifacts live in `.planning/`:

- `.planning/PROJECT.md` — project context and core decisions
- `.planning/REQUIREMENTS.md` — 41 mapped v1 requirements
- `.planning/ROADMAP.md` — 5-phase roadmap
- `.planning/STATE.md` — current phase state
- `.planning/research/` — stack, features, architecture, pitfalls, and summary research

Current focus: Phase 4 — Live Tail, Discovery, and Persistence. The next GSD step is `/gsd-plan-phase 4`.

# Branching Workflow

- One dev branch per phase. Name it after the phase (e.g. `phase-15`, `phase-16-foo`). All `gsd-execute-phase` work and `.planning/` updates for that phase live on the phase branch.
- **When a phase is complete and verified, ALWAYS squash-merge it back into `main` automatically as the final step — do not wait for the user to ask.** Procedure:
  1. Ensure the phase branch is clean (`git status` empty) and all phase commits are in.
  2. `git checkout main && git pull --ff-only` (abort if pull fails; report to user).
  3. `git merge --squash <phase-branch>` then `git commit` with a single phase-sized message (include `(Written by Copilot)`).
  4. Leave the phase branch in place locally for reference; do NOT delete it.
  5. Do NOT push `main` or the phase branch to the remote unless the user explicitly asks. The squash-merge stays local until pushed.
  6. Report the resulting `main` commit SHA to the user.
- Per-plan atomic commits are preserved on the phase branch but collapse into one phase-sized commit on `main`.
- Quick fixes that fit in a single commit may go directly to `main`. Anything larger gets a phase branch.
- `.planning/` bookkeeping that happens between phases (backlog grooming, STATE updates) is a quick fix and may go straight to `main`.
- Do not force-push `main` without explicit per-operation approval from Rob.

# Engineering Constraints

- Build standalone first; defer VS Code extension packaging until after v1.
- Target real JSONL logs as the canonical format; the existing human-readable sample log is only a legacy fixture adapter.
- Keep core parser, event model, EventStore, correlator, and search/filter projections portable TypeScript with no direct Node or DOM dependencies.
- Enforce local-only privacy: no telemetry, no CDN assets, and no outbound network dependencies for viewing logs.
- Make virtualization, incremental parsing, and JSON-RPC-safe request/response correlation foundational, not later optimizations.
