---
phase: 02-vertical-slice-cli-server-timeline
plan: 00
subsystem: foundations
tags: [ui-scaffold, react, vite, tailwind, vitest, jsdom, fonts, event-row, projection, boundary-tests, security-allowlist]

requires:
  - phase: 01-core-foundations
    provides: AhpEvent envelope, Status enum, Correlator, EventStore, boundary + security tests
provides:
  - Split portable vs UI import boundary (UI_FORBIDDEN_PATTERNS) so React/Vite are legal under packages/ui/src only
  - Phase-2 dependency allow-list (react, react-dom, vite, @vitejs/plugin-react, @tanstack/react-virtual, zustand, lucide-react, tailwindcss, @tailwindcss/vite, jsdom, @testing-library/{react,user-event,jest-dom}, open, @types/react, @types/react-dom, @ahp-inspector/ui)
  - "no CDN URLs in UI source" guardrail covering packages/ui/src and packages/ui/index.html
  - @ahp-inspector/ui workspace package (Vite 8 + React 19 + Tailwind 4 + jsdom Vitest) with smoke test
  - Vendored Inter Variable + JetBrains Mono Variable woff2 with OFL LICENSE files
  - Locked EventRow projection contract + projectRow() pure function exported from @ahp-inspector/core
affects: [02-01, 02-02, 02-03, 02-04, 02-05, 02-06]

tech-stack:
  added: [react@19.2.6, react-dom@19.2.6, vite@8.0.10, "@vitejs/plugin-react@6.0.1", "@tanstack/react-virtual@3.13.24", zustand@5.0.13, lucide-react@1.14.0, tailwindcss@4.2.4, "@tailwindcss/vite@4.2.4", jsdom@29.1.1, "@testing-library/react@16.3.2", "@testing-library/user-event@14.6.1", "@testing-library/jest-dom@6.5.0", open@11.0.0]
  patterns:
    - "Split import boundaries by package class (portable vs browser UI)"
    - "Vendored static assets with co-located LICENSE files; CDN-URL guard test"
    - "Pure projection contracts published from @ahp-inspector/core for both server projector and UI consumers"

key-files:
  created:
    - packages/ui/package.json
    - packages/ui/tsconfig.json
    - packages/ui/vite.config.ts
    - packages/ui/vitest.config.ts
    - packages/ui/index.html
    - packages/ui/src/main.tsx
    - packages/ui/src/App.tsx
    - packages/ui/src/App.test.tsx
    - packages/ui/src/test-setup.ts
    - packages/ui/public/fonts/inter/InterVariable.woff2
    - packages/ui/public/fonts/inter/LICENSE.txt
    - packages/ui/public/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2
    - packages/ui/public/fonts/jetbrains-mono/LICENSE.txt
    - packages/core/src/row-projection.ts
    - packages/core/src/row-projection.test.ts
  modified:
    - test/boundary.test.ts
    - test/security.test.ts
    - packages/core/src/index.ts
    - pnpm-lock.yaml

key-decisions:
  - "EventRow contract owned by @ahp-inspector/core (portable, no DOM/Node imports) so server projector and UI row component cannot drift"
  - "Vendor JetBrains Mono Variable from the @fontsource-variable jsdelivr build (no official upstream Variable woff2 in the JetBrains/JetBrainsMono webfonts release tree)"
  - "Inter Variable vendored from rsms.me canonical font-files release"
  - "CDN-URL guard scans both packages/ui/src and packages/ui/index.html; line/block comments excluded so attribution comments remain legal"

patterns-established:
  - "Boundary test: PORTABLE_ROOTS use FORBIDDEN_PATTERNS; UI_ROOTS use UI_FORBIDDEN_PATTERNS — same walker, package-class-specific allowlists"
  - "Row projection helpers (bandFor, dirGlyphFor, kindTagFor, actionFamilyFor, formatTs, payloadPreviewOf) are pure and exported individually for direct test/reuse"
  - "JSX type imported via `import type { JSX } from 'react'` for React 19 (no global JSX namespace)"

requirements-completed: [INGEST-06, EVENT-04, EVENT-05, TIME-01, TIME-02, TIME-03, TIME-06]

duration: 20min
completed: 2026-05-07
---

# Phase 02 Plan 00: Wave 0 — UI Workspace + EventRow Contract Summary

**React/Vite legalised under packages/ui only, @ahp-inspector/ui scaffolded with vendored OFL fonts, and the locked EventRow projection contract published from @ahp-inspector/core for Wave-1 server + timeline consumers.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-07T14:13:00Z
- **Completed:** 2026-05-07T14:32:44Z
- **Tasks:** 3 / 3
- **Files modified:** 19 (15 code/config + 4 binary/license assets)

## Accomplishments

- Boundary + security guardrails refactored: portable packages still reject Node/DOM/host imports, UI gets its own forbidden-pattern set, Phase-2 deps explicitly allow-listed, and a CDN-URL test now protects local-only posture.
- @ahp-inspector/ui workspace package builds (`pnpm -F @ahp-inspector/ui build` → 190.5 kB JS) and runs Vitest in jsdom (smoke test green).
- Inter Variable + JetBrains Mono Variable woff2 fonts vendored under `packages/ui/public/fonts/` with SIL OFL 1.1 LICENSE.txt files.
- `EventRow` interface, `projectRow()`, and helper functions (`bandFor`, `dirGlyphFor`, `kindTagFor`, `actionFamilyFor`, `formatTs`, `payloadPreviewOf`) exported from `@ahp-inspector/core`; 42 unit tests cover all enum branches, latency-band boundaries (49/50/199/200/999/1000), parse-error fallback, and field formatting.
- Repo-wide test suite green: 151 / 151 tests passing across 14 files.

## Task Commits

1. **Task 1: Split boundary + security guardrails for UI** — `161a721` (test)
2. **Task 2: Scaffold @ahp-inspector/ui package + vendor fonts** — `9f95182` (feat)
3. **Task 3: Publish EventRow projection contract from @ahp-inspector/core** — `8f52d80` (feat)

## Files Created/Modified

- `test/boundary.test.ts` — split PORTABLE_ROOTS and UI_ROOTS; added UI_FORBIDDEN_PATTERNS describe block; walker now picks up `.tsx` too
- `test/security.test.ts` — extended ALLOW set with Phase-2 deps + `@ahp-inspector/ui`; added "no CDN URLs in UI source" describe block with comment-stripper
- `packages/ui/package.json` — new workspace package, scripts (build/dev/test/typecheck), pinned React 19 / Vite 8 / Tailwind 4 / Vitest jsdom deps
- `packages/ui/tsconfig.json` — extends base, jsx="react-jsx", DOM lib, bundler resolution
- `packages/ui/vite.config.ts` — react + tailwind plugins, host 127.0.0.1:5174 strictPort, sourcemaps on, target es2022
- `packages/ui/vitest.config.ts` — jsdom env, react plugin, test-setup file, src/**/*.test.{ts,tsx}
- `packages/ui/index.html` — minimal app shell with `data-theme="dark"` and root mount point
- `packages/ui/src/main.tsx` — StrictMode root using `react-dom/client.createRoot`
- `packages/ui/src/App.tsx` — placeholder rendering `<div data-testid="app-root">AHP Inspector</div>`
- `packages/ui/src/test-setup.ts` — imports `@testing-library/jest-dom/vitest`
- `packages/ui/src/App.test.tsx` — smoke test covering app-root render
- `packages/ui/public/fonts/inter/InterVariable.woff2` — 344 kB vendored Inter Variable from rsms.me
- `packages/ui/public/fonts/inter/LICENSE.txt` — Inter SIL OFL 1.1 license
- `packages/ui/public/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2` — 39 kB vendored variable wght woff2 from @fontsource-variable jsdelivr
- `packages/ui/public/fonts/jetbrains-mono/LICENSE.txt` — JetBrains Mono SIL OFL 1.1 license
- `packages/core/src/row-projection.ts` — locked `EventRow` interface + `projectRow()` pure function + helpers
- `packages/core/src/row-projection.test.ts` — 42 unit tests covering bands, kinds, action families, parse-error projection, status round-trip, ts/dir/key formatting
- `packages/core/src/index.ts` — barrel re-exports of row-projection types and helpers
- `pnpm-lock.yaml` — regenerated for the new UI deps

## Decisions Made

- Used the @fontsource-variable jsdelivr build for JetBrains Mono Variable because the official `JetBrains/JetBrainsMono` GitHub release tree publishes only static webfonts; this is still the canonical OFL 1.1 binary, just packaged differently. License file vendored from the upstream `OFL.txt`.
- Pinned every Phase-2 dep to the exact version named in the plan (vite 8.0.10, react 19.2.6, jsdom 29.1.1, lucide-react 1.14.0, etc.); all were verified published before install.
- Replaced the test fixture `payloadPreviewOf({ a: "x  y\n z" })` with `"x   y" → "x y"` because `JSON.stringify` escapes literal `\n` characters, so the original assertion would have been semantically wrong even with a passing implementation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] React 19 has no global JSX namespace**
- **Found during:** Task 2 (UI smoke test typechecking)
- **Issue:** `App(): JSX.Element` referenced an undeclared global; `@types/react` 19.x exports JSX as a named type.
- **Fix:** Added `import type { JSX } from "react";` to `packages/ui/src/App.tsx`.
- **Files modified:** packages/ui/src/App.tsx
- **Verification:** `pnpm -F @ahp-inspector/ui exec tsc --noEmit` → 0 errors; `pnpm typecheck` → all 7 packages green.
- **Committed in:** 9f95182 (part of task commit)

**2. [Rule 3 — Blocking] UI tsconfig used composite project flag the script didn't have**
- **Found during:** Task 2 (defining `typecheck` script)
- **Issue:** Plan specified `tsc -b --emitDeclarationOnly false --noEmit`, but the package isn't a TS project reference root — `tsc -b` would fail.
- **Fix:** Used `tsc --noEmit` (matches sibling packages like `@ahp-inspector/core`).
- **Files modified:** packages/ui/package.json
- **Verification:** `pnpm typecheck` exits 0.
- **Committed in:** 9f95182

**3. [Rule 3 — Blocking] Boundary walker did not pick up `.tsx`**
- **Found during:** Task 1 (verifying UI describe block would scan App.tsx in Task 2)
- **Issue:** Original walker filtered to `.ts` only; UI files are `.tsx`.
- **Fix:** Extended walker to accept `.ts` and `.tsx` (excluding `.test.ts`/`.test.tsx`).
- **Files modified:** test/boundary.test.ts
- **Verification:** Boundary test runs 19 cases (3 portable + 1 vacuous + 1 UI App.tsx + …) and stays green; would fail loudly if UI imports `node:fs`.
- **Committed in:** 161a721

**4. [Rule 2 — Missing critical functionality] `@types/react` and `@types/react-dom` not in security ALLOW**
- **Found during:** Task 2 (running security test after install)
- **Issue:** Plan listed runtime deps but omitted the type packages, so the allow-list test would fail as soon as the UI package.json was added.
- **Fix:** Added both `@types/react` and `@types/react-dom` to the ALLOW set in `test/security.test.ts`.
- **Files modified:** test/security.test.ts
- **Verification:** `pnpm vitest run test/security.test.ts` → 14/14 passing.
- **Committed in:** 161a721

---

**Total deviations:** 4 auto-fixed (3× Rule 3 — blocking, 1× Rule 2 — missing critical functionality)
**Impact on plan:** All four are correctness fixes that any execution would have hit; none change scope or cross the architectural-decision boundary.

## Issues Encountered

- Upstream JetBrains Mono GitHub repo has no `JetBrainsMono-Variable.woff2` in the official `webfonts/` release path. Resolved by vendoring the @fontsource-variable jsdelivr build (same OFL 1.1 binary). Documented above.

## Verification

- `pnpm vitest run` → 151 / 151 tests passing across 14 files
- `pnpm vitest run test/boundary.test.ts test/security.test.ts packages/core/src/row-projection.test.ts` → all green
- `pnpm install && pnpm -F @ahp-inspector/ui build` → emits `dist/index.html` + 190.5 kB JS bundle
- `pnpm -F @ahp-inspector/ui test` → smoke test green in jsdom
- `pnpm typecheck` → 7/7 packages clean
- `grep -rn "https\?://" packages/ui/src` → no matches outside comments

## Threat Model Status

| ID | Status |
|----|--------|
| T-02-00-01 (≡T-02-01) — UI import surface | mitigated; UI_FORBIDDEN_PATTERNS in test/boundary.test.ts |
| T-02-00-02 (≡T-02-02) — dependency allow-list | mitigated; ALLOW set extended with Phase-2 deps |
| T-02-00-03 — vendored fonts / no CDN | mitigated; "no CDN URLs in UI source" test active, fonts + LICENSE under packages/ui/public/fonts |
| T-02-00-04 — EventRow projection | accepted; pure function, no IO |

## Self-Check: PASSED

- FOUND: test/boundary.test.ts (modified, contains UI_FORBIDDEN_PATTERNS)
- FOUND: test/security.test.ts (modified, contains @ahp-inspector/ui + @tanstack/react-virtual + CDN-URL test)
- FOUND: packages/ui/package.json
- FOUND: packages/ui/tsconfig.json
- FOUND: packages/ui/vite.config.ts
- FOUND: packages/ui/vitest.config.ts
- FOUND: packages/ui/index.html
- FOUND: packages/ui/src/main.tsx
- FOUND: packages/ui/src/App.tsx
- FOUND: packages/ui/src/App.test.tsx
- FOUND: packages/ui/src/test-setup.ts
- FOUND: packages/ui/public/fonts/inter/InterVariable.woff2 (344 kB)
- FOUND: packages/ui/public/fonts/inter/LICENSE.txt
- FOUND: packages/ui/public/fonts/jetbrains-mono/JetBrainsMono-Variable.woff2 (39 kB)
- FOUND: packages/ui/public/fonts/jetbrains-mono/LICENSE.txt
- FOUND: packages/core/src/row-projection.ts
- FOUND: packages/core/src/row-projection.test.ts
- FOUND: packages/core/src/index.ts (modified, re-exports row-projection)
- FOUND commit: 161a721 (Task 1)
- FOUND commit: 9f95182 (Task 2)
- FOUND commit: 8f52d80 (Task 3)
