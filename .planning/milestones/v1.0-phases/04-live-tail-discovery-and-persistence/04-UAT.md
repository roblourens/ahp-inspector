---
phase: 04-live-tail-discovery-and-persistence
plan: 07
status: passed
captured: 2026-05-08
viewport: 1440x900
tooling: Playwright browser automation from session workspace
---

# Phase 4 Visual UAT

Visual UAT covered the Phase 4 discovery, manual-open, live-tail, pause, switch-log,
rotation, and watch-error surfaces against the built local app.

## Setup

1. Built the UI with `pnpm -F @ahp-inspector/ui build`.
2. Started the real CLI with no active file: `pnpm exec tsx packages/cli/src/index.ts --port 0 --no-open`.
3. Pointed `HOME`/`USERPROFILE`/`APPDATA` at synthetic VS Code-shaped log roots for candidate/no-candidate scenarios.
4. Drove Chromium at 1440x900 through Playwright installed in the session workspace, not as a project dependency.

## Results

| # | Screenshot | Status | Visual fidelity notes |
|---|------------|--------|-----------------------|
| 1 | `screenshots/phase4/01-no-active-log.png` | Pass | Initial picker shows mixed-confidence discovered candidates with safe basenames and no absolute path surfaces. |
| 2 | `screenshots/phase4/02-no-candidates-hint.png` | Pass | No-candidates state is distinct from no-server and keeps manual-open fallback visible. |
| 3 | `screenshots/phase4/03-manual-open-error-not-found.png` | Pass | Missing-file error uses fixed copy: "File not found. Check the path and try again."; it does not echo the typed value. |
| 4 | `screenshots/phase4/04-manual-open-error-too-long.png` | Pass | Path-length validation uses fixed copy: "Path is too long." |
| 5 | `screenshots/phase4/05-app-shell-with-rows.png` | Pass | Selecting a discovered log opens the populated timeline with header controls and safe basename metadata. |
| 6 | `screenshots/phase4/06-live-pause-button-paused.png` | Pass | Pause state is visually distinct and exposes the resume state via the header control. |
| 7 | `screenshots/phase4/07-new-events-pill.png` | Pass | Appending while paused preserves visible rows and shows the new-events pill instead of pulling the user to the bottom. |
| 8 | `screenshots/phase4/08-switch-log-panel.png` | Pass | Switch-log panel opens as an overlay while preserving the current timeline context behind it. |
| 9 | `screenshots/phase4/09-rotation-banner.png` | Pass | Rotation banner appears with UI-SPEC copy: "Log rotated — reloading from new file." |
| 10 | `screenshots/phase4/10-watch-error-banner.png` | Pass | Watch-error banner displays mapped safe copy plus "Retry Connection" and "Reopen log" actions. |

## Privacy Review

- Candidate rows show labels, confidence, origin, recency, and size only.
- Manual-open errors do not echo the typed value.
- Active-log metadata shows only the basename and aggregate counts.
- Browser body text was checked before every screenshot for `/Users/`, `\Users\`, `/home/`, and Windows drive-style absolute paths.

## Accessibility / Interaction Review

- The no-log picker keeps keyboard focus on the first candidate or manual-open input.
- Manual-open input exposes errors through an alert region.
- Switch-log overlay is a non-modal dialog and closes with Escape.
- Live-pause state is available via the header button and Space-key behavior is covered by automated TimelineRegion tests.
- New-events pill text uses the UI-SPEC "Resume Following" action copy.

## Notes

- The planned `pnpm dev:mock-server` / `pnpm dev:cli` scripts do not exist, so UAT used the real CLI and synthetic VS Code log roots instead.
- The watch-error visual state can be OS-event dependent; automated component tests cover the exact code mapping and button behavior, and this UAT captured the rendered safe banner state.
- Playwright tooling was installed under the session workspace to avoid changing the project dependency allowlist.

## Approval

Passed for Phase 4 execution completion.
