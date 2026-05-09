# Phase 05: Themes, Polish, and Verification - Research

**Researched:** 2026-05-08
**Domain:** React/Vite UI theming, responsive layout polish, Vitest/jsdom UI tests, Playwright/browser E2E validation
**Confidence:** HIGH for codebase state; MEDIUM for recommended Playwright addition; HIGH for npm version checks.

## Executive Summary

Phase 5 is not greenfield: the app already has a functioning three-theme foundation using `data-theme` on `document.documentElement`, theme tokens in `packages/ui/src/styles/tokens.css`, a compact `HeaderBar` theme picker, and persisted theme selection under `localStorage["ahp-theme"]`. [VERIFIED: packages/ui/src/main.tsx, packages/ui/src/components/shell/HeaderBar.tsx, packages/ui/src/styles/tokens.css] The main work is therefore polish and hardening: make the existing light/dark/hacker palettes feel deliberate across all surfaces, remove remaining component-level non-token color literals such as `rgba(0,0,0,0.35)`, add theme-specific accent tokens/effects, and expand tests so regressions are caught. [VERIFIED: packages/ui/src/components/shell/HeaderBar.tsx, packages/ui/src/styles/no-hex-in-components.test.ts]

Responsive layout is the highest implementation risk. The current `AppShell` uses a horizontal flex split with the detail panel always mounted at `detailWidth` pixels, while the timeline grid uses fixed column widths plus `1fr`. [VERIFIED: packages/ui/src/components/shell/AppShell.tsx, packages/ui/src/components/timeline/EventRow.tsx, packages/ui/src/components/timeline/TimelineList.tsx] This will likely be acceptable on wide displays but can become cramped on typical laptop widths when the detail panel is open. [ASSUMED] Phase 5 should introduce explicit responsive breakpoints/tokens, a laptop-friendly detail behavior, and an ultra-wide composition rule before visual polish, because theme review depends on stable layout. [ASSUMED]

Testing is partly present but not sufficient for VERIFY-02/VERIFY-03. Vitest/jsdom UI tests already cover many components: timeline virtualization, row cells, detail panel, filters, picker, states, theme picker persistence, store persistence, SSE client, and vertical-slice server flows. [VERIFIED: test list from repository; packages/ui/src/components/**.test.tsx; test/phase4-vertical-slice.test.ts] There is no project Playwright config or Playwright dependency, although a global `playwright-cli` is available in this environment. [VERIFIED: package.json, package/ui/package.json, missing playwright.config.ts, environment probe] To satisfy VERIFY-03 as a repeatable gate, add a minimal Playwright E2E project dependency and config, unless the team explicitly accepts manual browser UAT plus server-level Vitest vertical slices as sufficient. [VERIFIED: npm registry for @playwright/test 1.59.1; ASSUMED: user preference for automated browser E2E]

**Primary recommendation:** Implement Phase 5 in four waves: responsive shell/layout tokens first, theme token polish second, persistence/preferences cleanup third, and UI/E2E/visual validation last. [ASSUMED]

## Current State

### Project constraints

- Standalone local web app first; VS Code extension packaging is deferred, but the host adapter boundary must stay intact. [VERIFIED: .github/copilot-instructions.md, .planning/STATE.md]
- The app must remain local-only: no telemetry, no CDN assets, and no outbound network dependencies for viewing logs. [VERIFIED: .github/copilot-instructions.md, .planning/REQUIREMENTS.md]
- `../agent-host-protocol` remains the source of truth for AHP protocol concepts; Phase 5 should not invent protocol semantics. [VERIFIED: .github/copilot-instructions.md]
- Existing planning state says Phase 4 is complete and Phase 5 is ready to plan. [VERIFIED: .planning/STATE.md]
- `tokens.css` is documented as the single source of truth for UI colors/spacing/typography variables, and a Vitest guard rejects raw quoted hex literals under `packages/ui/src/components/`. [VERIFIED: .planning/STATE.md, packages/ui/src/styles/no-hex-in-components.test.ts]

### Theme architecture

- Theme selection is applied by setting `document.documentElement[data-theme]` to `dark`, `light`, or `hacker`. [VERIFIED: packages/ui/src/main.tsx, packages/ui/src/components/shell/HeaderBar.tsx]
- Initial theme is read from `localStorage["ahp-theme"]`; invalid or unavailable storage falls back to `dark`. [VERIFIED: packages/ui/src/main.tsx]
- The header theme picker persists selection back to `localStorage["ahp-theme"]` and updates the document attribute immediately. [VERIFIED: packages/ui/src/components/shell/HeaderBar.tsx]
- Theme picker tests already verify compact menu behavior and light-theme persistence. [VERIFIED: packages/ui/src/components/shell/HeaderBar.test.tsx]
- `tokens.css` defines root/dark, light, and hacker theme blocks, including surface, text, semantic, direction, kind, action, latency, search, chip, group/gap/auth, JSON, and Phase 4 picker/live/banner tokens. [VERIFIED: packages/ui/src/styles/tokens.css]
- Pretty JSON colors are themeable via CSS classes such as `.ahp-json-key`, `.ahp-json-string`, `.ahp-json-number`, `.ahp-json-boolean`, `.ahp-json-null`, and `.ahp-json-punctuation`. [VERIFIED: packages/ui/src/styles/global.css, packages/ui/src/components/detail/PrettyJsonView.tsx]
- Components mostly use CSS variables directly in inline styles rather than CSS modules or class styles. [VERIFIED: packages/ui/src/components/**/*.tsx]
- The existing no-hex guard catches quoted `#RGB`/`#RRGGBB` literals in component `.tsx` files, but it does not catch `rgba(...)`, `hsl(...)`, unquoted object-style colors, `boxShadow` raw colors, or raw colors outside components. [VERIFIED: packages/ui/src/styles/no-hex-in-components.test.ts; packages/ui/src/components/shell/HeaderBar.tsx]
- `HeaderBar` currently contains `boxShadow: "0 8px 24px rgba(0,0,0,0.35)"`, which is a non-token color literal and should be tokenized or covered by an expanded guard. [VERIFIED: packages/ui/src/components/shell/HeaderBar.tsx]

### Current theme gaps

- The three theme blocks exist, but Phase 5 still marks THEME-01/THEME-02/THEME-03/THEME-04/THEME-05 as pending. [VERIFIED: .planning/REQUIREMENTS.md]
- Hacker theme currently has neon green/cyan/yellow/purple/red token values, but no extra structural aesthetic tokens or CSS effects beyond palette differences. [VERIFIED: packages/ui/src/styles/tokens.css, packages/ui/src/styles/global.css]
- Light theme has token coverage but needs visual review across all surfaces, especially JSON, chips, group headers, banners, selected rows, and destructive/warning states. [ASSUMED]
- Dark theme is the implicit default through `:root, [data-theme="dark"]`, so regressions in dark tokens affect default app render. [VERIFIED: packages/ui/src/styles/tokens.css]
- Tokens include many direct hex values in `tokens.css`; that is acceptable because token files are the color source of truth. [VERIFIED: .planning/STATE.md, packages/ui/src/styles/tokens.css]

### Current layout architecture

- `AppShell` is a vertical shell: `HeaderBar`, optional `WatchErrorBanner`, `SourceStrip`, `FilterBar`, optional `ActiveFilterChips`, main content split, `StatusBar`, and `LogPickerPanel`. [VERIFIED: packages/ui/src/components/shell/AppShell.tsx]
- Main content is a horizontal flex layout with timeline on the left and detail panel wrapper on the right. [VERIFIED: packages/ui/src/components/shell/AppShell.tsx]
- Detail panel width is stored in Zustand as `detailWidth`, defaults to `420`, and is clamped to `360-720` in `setDetailWidth`. [VERIFIED: packages/ui/src/state/store.ts]
- `DetailResizeHandle` supports mouse drag and keyboard left/right resize, with min/max props passed as `360` and `720`. [VERIFIED: packages/ui/src/components/detail/DetailResizeHandle.tsx, packages/ui/src/components/detail/DetailPanel.tsx]
- There is a `.detail-rail` CSS class with a max-width media rule that hides below `1023.98px`, but the current `DetailPanel`/wrapper path does not use that class. [VERIFIED: packages/ui/src/styles/global.css, packages/ui/src/components/shell/AppShell.tsx, packages/ui/src/components/detail/DetailPanel.tsx]
- Timeline rows use `TIMELINE_GRID_COLUMNS = "2px 96px 16px 44px 240px 132px 72px 64px 72px 96px 1fr"`. [VERIFIED: packages/ui/src/components/timeline/EventRow.tsx]
- `TimelineList` renders the same grid columns for the header and rows and uses TanStack Virtual for row virtualization. [VERIFIED: packages/ui/src/components/timeline/TimelineList.tsx]
- The filter bar uses a single horizontal flex row with `flexWrap: "nowrap"` and `overflow: "visible"`, with the group toggle right-aligned by `marginLeft: "auto"`. [VERIFIED: packages/ui/src/components/filters/FilterBar.tsx]
- Ultra-wide behavior is currently implicit: timeline expands and payload column gets extra space while detail panel remains fixed/clamped. [VERIFIED: packages/ui/src/components/shell/AppShell.tsx, packages/ui/src/components/timeline/EventRow.tsx]

### Current persistence architecture

- Per-log viewer preferences persist under `localStorage["ahp-log-prefs-v1"]`, keyed by opaque `logKey`. [VERIFIED: packages/ui/src/state/persistence.ts]
- Persisted per-log preferences include `searchQuery`, `filters`, `grouping`, `groupCollapsed`, `selectedIdx`, `detailWidth`, and `livePaused`. [VERIFIED: packages/ui/src/state/persistence.ts]
- Per-log persistence caps remembered logs to 50 entries and caps collapsed groups to 1000 entries. [VERIFIED: packages/ui/src/state/persistence.ts, packages/ui/src/state/persistence.test.ts]
- `usePersistEffect` hydrates after rows transition from `0` to `N` for a `logKey`, debounces saves by 250ms, flushes old log prefs on log switch, and disables saves after quota errors. [VERIFIED: packages/ui/src/persistence/persist-effect.ts, packages/ui/src/persistence/persist-effect.test.ts]
- Theme choice is global, not per-log, and uses separate key `ahp-theme`. [VERIFIED: packages/ui/src/main.tsx, packages/ui/src/components/shell/HeaderBar.tsx]
- No current migration framework exists for theme or per-log preference storage beyond schema version checking for per-log prefs. [VERIFIED: packages/ui/src/state/persistence.ts, packages/ui/src/main.tsx]

### Current test architecture

- Root test command is `pnpm test`, which runs `vitest run`. [VERIFIED: package.json]
- Root Vitest config includes `test/**/*.test.ts`, `packages/*/src/**/*.test.ts`, and `packages/*/test/**/*.test.ts`, uses default reporter, and pool `forks`. [VERIFIED: vitest.config.ts]
- UI package test command is `pnpm -F @ahp-inspector/ui test`, which runs `vitest run`. [VERIFIED: packages/ui/package.json]
- UI package Vitest config uses React plugin, jsdom environment, `src/test-setup.ts`, and includes `src/**/*.test.{ts,tsx}`. [VERIFIED: packages/ui/vitest.config.ts]
- `src/test-setup.ts` loads `@testing-library/jest-dom/vitest`. [VERIFIED: packages/ui/src/test-setup.ts]
- Existing UI tests cover the theme picker, timeline cells, virtualized row count, timeline region keyboard/live states, detail panel states, filters, picker, state screens, per-log persistence, and transport clients. [VERIFIED: repository test list and corresponding test files]
- Server/integration tests cover SSE stream behavior and Phase 4 CLI/session/discovery/tail vertical slice. [VERIFIED: test/sse-integration.test.ts, test/phase4-vertical-slice.test.ts]
- There is no checked-in `e2e/` directory, `playwright.config.ts`, or Playwright project dependency. [VERIFIED: repository path checks, package.json, packages/ui/package.json]
- Global `playwright-cli` is available in this machine at version `0.1.12`, but it is not a project dependency and should not be the only automated VERIFY-03 path. [VERIFIED: environment probe]

## Requirements Mapping

| Requirement | Current Support | Gap to Plan | Recommended Evidence |
|---|---|---|---|
| THEME-01: switch polished light/dark/hacker | Picker, `data-theme`, and three token blocks already exist. [VERIFIED: HeaderBar.tsx, main.tsx, tokens.css] | Polish palettes across all UI states and add stronger tests for all three themes. [ASSUMED] | UI tests assert document `data-theme`, persisted value, and representative computed styles/tokens for all themes. [ASSUMED] |
| THEME-02: design tokens, no hard-coded component colors | Token system and hex guard exist. [VERIFIED: tokens.css, no-hex-in-components.test.ts] | Expand guard to catch raw `rgba/hsl/color literals` in components and move remaining shadow/color values into tokens. [VERIFIED: HeaderBar.tsx; ASSUMED for guard pattern] | Guard test plus targeted grep-style test for forbidden color functions in components. [ASSUMED] |
| THEME-03: distinctive hacker aesthetic | Hacker palette exists. [VERIFIED: tokens.css] | Add intentional hacker-only CSS effects/tokens beyond green-on-black: glow, terminal grid/scanline overlay, sharper borders, syntax accent differences, reduced-motion safeguards. [ASSUMED] | Browser/UAT screenshots for hacker mode and token tests showing hacker-specific tokens. [ASSUMED] |
| THEME-04: theme choice and key prefs persist | Theme persists globally; per-log prefs persist by `logKey`. [VERIFIED: main.tsx, HeaderBar.tsx, persistence.ts, persist-effect.ts] | Decide if additional "key viewer preferences" are needed beyond existing filter/group/selection/detail/livePaused and theme. [ASSUMED] | Persistence tests for theme fallback and existing prefs; optional migration tests if schema changes. [ASSUMED] |
| THEME-05: responsive laptop to ultra-wide | Current flex and fixed-width layout exists. [VERIFIED: AppShell.tsx, EventRow.tsx] | Add explicit breakpoints and layout behavior for narrow laptop, normal desktop, ultra-wide, and detail-open states. [ASSUMED] | jsdom layout-style tests plus browser screenshots at 1366x768, 1440x900, 1920x1080, and 2560x1440. [ASSUMED] |
| VERIFY-02: UI tests cover timeline, selection, detail, filters/search, theme, empty, parse-error | Many component tests exist. [VERIFIED: test list] | Add missing cross-component/app-level UI tests that exercise complete flows rather than isolated components. [ASSUMED] | Targeted `pnpm -F @ahp-inspector/ui test ...` files plus full `pnpm test`. [VERIFIED: package scripts] |
| VERIFY-03: E2E tests cover opening fixture, filtering/searching, expanding details, appended events | Server vertical slices cover much of ingestion/tail without browser. [VERIFIED: phase4-vertical-slice.test.ts] | Add browser E2E, preferably Playwright, to drive real UI against CLI/server and a fixture file. [ASSUMED] | `pnpm e2e` or equivalent Playwright command; fallback manual UAT with `playwright-cli`. [ASSUMED] |

## Standard Stack

### Existing stack to keep

| Library / Tool | Version | Purpose | Why Standard |
|---|---:|---|---|
| React | 19.2.6 | UI rendering | Already installed and used by all UI components. [VERIFIED: packages/ui/package.json; npm registry] |
| Vite | 8.0.10 | UI build/dev server | Existing UI build tool. [VERIFIED: packages/ui/package.json] |
| Vitest | 4.1.5 | Unit/component/integration tests | Existing root and package test framework. [VERIFIED: package.json; npm registry] |
| jsdom | 29.1.1 | DOM environment for UI tests | Existing UI Vitest environment. [VERIFIED: packages/ui/package.json; npm registry] |
| Testing Library React | 16.3.2 | React component tests | Existing component test library. [VERIFIED: packages/ui/package.json; npm registry] |
| Zustand | 5.0.13 | UI store | Existing app state surface. [VERIFIED: packages/ui/package.json] |
| TanStack React Virtual | 3.13.24 | Timeline virtualization | Existing virtualization implementation. [VERIFIED: packages/ui/package.json; npm registry] |
| react-json-view-lite | 2.5.0 | Pretty JSON tree | Existing detail JSON renderer. [VERIFIED: packages/ui/package.json; npm registry] |

### Recommended addition for VERIFY-03

| Library / Tool | Version | Purpose | Why Standard |
|---|---:|---|---|
| `@playwright/test` | 1.59.1 | Automated browser E2E | Browser-level E2E is the most direct way to verify opening a fixture log, filtering/searching, selecting details, switching themes, and following appended events. [VERIFIED: npm registry; ASSUMED: project accepts dependency] |

**Installation if accepted:**

```bash
pnpm add -D @playwright/test
```

[VERIFIED: package manager is pnpm 9.15.0 from environment probe]

**No-new-dependency fallback:** Use existing Vitest server vertical slices plus manual `playwright-cli` UAT, but this is weaker for VERIFY-03 because browser E2E would not be committed as a repeatable test gate. [VERIFIED: playwright-cli available; ASSUMED: VERIFY-03 expects automated browser coverage]

## Implementation Strategy

### 1. Preserve and strengthen token-first architecture

- Keep `packages/ui/src/styles/tokens.css` as the only place for raw theme color values. [VERIFIED: .planning/STATE.md, tokens.css]
- Add semantic tokens rather than styling individual components per theme. [ASSUMED]
- Recommended new tokens: `--shadow-menu`, `--shadow-panel`, `--focus-ring`, `--row-selected-bg`, `--row-hover-bg`, `--hacker-glow`, `--hacker-grid-opacity`, `--hacker-scanline-opacity`, `--layout-shell-max-width`, `--detail-width-min`, `--detail-width-max`, and breakpoint-adjacent spacing tokens. [ASSUMED]
- Move `HeaderBar` menu shadow from raw `rgba(0,0,0,0.35)` to `var(--shadow-menu)`. [VERIFIED: HeaderBar.tsx]
- Expand `no-hex-in-components.test.ts` into a broader no-raw-color guard for component sources. [VERIFIED: existing test path; ASSUMED: implementation shape]

### 2. Polish each theme as a product surface

- Dark theme should remain the baseline and default because `:root` shares the dark token block. [VERIFIED: tokens.css]
- Light theme needs contrast review for JSON syntax, chips, group headers, banners, selected row, and search highlights. [ASSUMED]
- Hacker theme should use a coherent aesthetic beyond green-on-black by adding token-driven glow, subtle terminal grid/scanline background, sharper borders, and differentiated JSON colors. [ASSUMED]
- Hacker-specific visual effects should live in global CSS selectors such as `[data-theme="hacker"] body` or `[data-theme="hacker"] #root` and be controlled by tokens, not component conditionals. [ASSUMED]
- Hacker effects should respect `prefers-reduced-motion`; existing global CSS already disables `.spin` animation under reduced motion, so use the same pattern for any new animation. [VERIFIED: global.css; ASSUMED for new effects]

### 3. Make responsive layout explicit

- Add layout tokens and media queries in `global.css` or a dedicated layout stylesheet imported from `global.css`. [ASSUMED]
- Replace hardcoded detail min/max values in `DetailPanel` and `store.setDetailWidth` with shared constants or CSS-aligned constants so JS clamp and CSS breakpoints do not diverge. [VERIFIED: store.ts, DetailPanel.tsx; ASSUMED for refactor]
- For laptop widths, choose one clear behavior: either collapse detail panel to an overlay/drawer or hide it until a row is selected and allow dismiss. [ASSUMED]
- The existing unused `.detail-rail` media rule should either be removed or wired correctly; leaving unused responsive CSS creates false confidence. [VERIFIED: global.css, AppShell.tsx]
- Timeline should remain usable if horizontal overflow occurs; plan tests for column header alignment, selected row visibility, and detail panel not crushing the timeline. [ASSUMED]
- For ultra-wide, avoid an unbounded "empty ocean" by preserving detail max width and allowing the payload column/timeline to absorb useful extra width. [VERIFIED: current detail max behavior; ASSUMED: visual quality target]

### 4. Treat persistence as a compatibility surface

- Keep global theme persistence separate from per-log preferences unless a user decision says theme should be per-log. [VERIFIED: main.tsx, persistence.ts; ASSUMED: global theme is desired]
- If adding new persisted preferences, bump or extend schemas deliberately and add invalid-schema/migration tests. [VERIFIED: current per-log schema validates `v: 1`; ASSUMED for new prefs]
- Do not persist log content, paths, prompts, raw payloads, or absolute identifiers. [VERIFIED: persistence.ts comments and local-only/privacy constraints]
- Preserve `logKey`-scoped per-log preferences for search/filter/grouping/selection/detail width/livePaused. [VERIFIED: persistence.ts, persist-effect.ts]

### 5. Add tests before broad visual changes where practical

- Add guard tests first so subsequent polish cannot introduce raw component colors. [ASSUMED]
- Add responsive style tests around `AppShell`, detail wrapper, and filter bar before changing layout. [ASSUMED]
- Extend `HeaderBar.test.tsx` for all three themes, invalid stored theme fallback, and storage exception fallback. [VERIFIED: current HeaderBar.test.tsx only checks light persistence; ASSUMED for expansion]
- Add app-level UI tests that compose rows + filters + selection + detail and verify flows required by VERIFY-02. [ASSUMED]
- Add Playwright E2E only after layout/theme selectors and test IDs are stable. [ASSUMED]

## Suggested Plan Breakdown

### Wave 0 — Test/guardrails foundation

1. Add/expand raw color guard to reject quoted hex, `rgba(...)`, `rgb(...)`, `hsl(...)`, and `hsla(...)` in `packages/ui/src/components/**/*.tsx`, with allowlist only if absolutely necessary. [ASSUMED]
2. Add theme token completeness test that verifies dark/light/hacker define the same required token names. [ASSUMED]
3. Add responsive constants test or snapshot-style assertions for layout class/token names. [ASSUMED]
4. If accepting Playwright, add `@playwright/test`, `playwright.config.ts`, and `pnpm e2e` script. [VERIFIED: package scripts currently lack e2e; npm registry version verified]

### Wave 1 — Responsive shell and detail layout

1. Introduce layout tokens/classes for shell, content split, timeline pane, detail pane, and breakpoints. [ASSUMED]
2. Wire or replace the unused `.detail-rail` rule. [VERIFIED: global.css currently has unused `.detail-rail`]
3. Define laptop behavior for detail panel: collapse/overlay or conditional hide. [ASSUMED]
4. Add tests for detail width clamping, narrow viewport behavior, and ultra-wide stability. [ASSUMED]

### Wave 2 — Theme polish and hacker aesthetic

1. Normalize theme token sets across dark/light/hacker. [VERIFIED: token sets broadly exist; ASSUMED: normalization needed]
2. Move component shadow/raw color values into tokens. [VERIFIED: HeaderBar.tsx]
3. Add hacker-specific token-driven CSS effects in global styles with reduced-motion protection. [ASSUMED]
4. Review Pretty JSON, filter chips, timeline selected rows, parse-error rows, banners, picker, and copy toast across all themes. [ASSUMED]
5. Update USER_GUIDE screenshots/references if final visuals change. [VERIFIED: USER_GUIDE.md includes theme section and screenshots]

### Wave 3 — Persistence/preferences hardening

1. Extend theme tests for all theme values and invalid stored value fallback. [ASSUMED]
2. Confirm global theme plus per-log preferences persist across reloads. [VERIFIED: architecture exists; ASSUMED for integrated test]
3. If adding preference schema fields, add version/migration tests. [ASSUMED]
4. Verify no paths/log content are persisted. [VERIFIED: persistence.ts only stores UI prefs; ASSUMED: add explicit test]

### Wave 4 — VERIFY-02 UI coverage

1. Timeline rendering and row selection: app-level test with multiple rows and selected detail state. [ASSUMED]
2. Detail view: select row, mock `fetchEvent`, show Pretty JSON, switch Raw tab. [VERIFIED: DetailPanel.test.tsx covers isolated behavior; ASSUMED: app-level coverage needed]
3. Filtering/search: type search, open facet, select filter, see visible count/no-results. [VERIFIED: FilterBar.test.tsx covers component pieces; ASSUMED: integrated coverage needed]
4. Theme switching: switch to each theme and assert `data-theme`, persisted storage, and representative UI state remains accessible. [VERIFIED: HeaderBar.test.tsx partial]
5. Empty/parse-error states: render connected empty rows and all-parse-error rows through `TimelineRegion`. [VERIFIED: states tests partial; TimelineRegion has all-parse-error branch]

### Wave 5 — VERIFY-03 E2E and visual/UAT gate

1. Add browser E2E that starts the CLI against a fixture log and opens the printed loopback URL. [ASSUMED]
2. Drive UI: verify rows render, search/filter, select row, detail panel opens, switch theme, append event to fixture, observe new row or live-follow behavior. [ASSUMED]
3. Preserve privacy assertions for absolute path leakage in browser-visible text. [VERIFIED: Phase 4 UAT privacy review pattern; test/phase4-vertical-slice.test.ts path assertions]
4. Capture UAT screenshots for light/dark/hacker and responsive viewports. [ASSUMED]

## Testing / Validation Architecture

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Unit/component framework | Vitest 4.1.5 + jsdom 29.1.1 + Testing Library React 16.3.2. [VERIFIED: package.json, packages/ui/package.json, npm registry] |
| Root config | `vitest.config.ts`. [VERIFIED: vitest.config.ts] |
| UI config | `packages/ui/vitest.config.ts`. [VERIFIED: packages/ui/vitest.config.ts] |
| Quick UI command | `pnpm -F @ahp-inspector/ui test`. [VERIFIED: packages/ui/package.json] |
| Full suite command | `pnpm test && pnpm -F @ahp-inspector/ui build && pnpm typecheck && pnpm lint`. [VERIFIED: package.json, packages/ui/package.json] |
| Browser E2E | Recommended `@playwright/test@1.59.1` if dependency accepted. [VERIFIED: npm registry; ASSUMED: acceptance] |
| Manual browser/UAT fallback | `playwright-cli` 0.1.12 is globally available in this environment. [VERIFIED: environment probe] |

### Phase requirements -> test map

| Req ID | Behavior | Test Type | Suggested Command | Existing Coverage |
|---|---|---|---|---|
| THEME-01 | Switch dark/light/hacker from UI | UI component + browser smoke | `pnpm -F @ahp-inspector/ui test src/components/shell/HeaderBar.test.tsx` | Partial: compact picker and light persistence. [VERIFIED] |
| THEME-02 | Components use tokens, not hard-coded colors | Static Vitest guard | `pnpm -F @ahp-inspector/ui test src/styles/no-hex-in-components.test.ts` | Partial: only quoted hex. [VERIFIED] |
| THEME-03 | Hacker mode is distinctive | UI/browser visual + token tests | `pnpm -F @ahp-inspector/ui test src/styles/*.test.ts` plus UAT | Gap. [ASSUMED] |
| THEME-04 | Theme and key prefs persist reloads | jsdom persistence tests + E2E reload | `pnpm -F @ahp-inspector/ui test src/persistence/persist-effect.test.ts src/state/persistence.test.ts src/components/shell/HeaderBar.test.tsx` | Partial: per-log prefs and light theme. [VERIFIED] |
| THEME-05 | Laptop-to-ultra-wide responsive layout | Browser E2E/UAT + style tests | Playwright viewport tests or manual UAT | Gap. [ASSUMED] |
| VERIFY-02 | UI test coverage for required states/flows | Vitest/jsdom integrated tests | `pnpm -F @ahp-inspector/ui test` | Partial: many isolated components. [VERIFIED] |
| VERIFY-03 | Open fixture, filter/search, expand details, appended events | Playwright E2E | `pnpm e2e` if added | Gap: server vertical slices exist but no browser E2E. [VERIFIED] |

### Recommended E2E shape

- Use a temporary copied fixture file so the test can append without mutating committed fixtures. [ASSUMED]
- Start CLI with `--port 0 --no-open` and parse `AHP Inspector running at http://127.0.0.1:<port>`. [VERIFIED: pattern in test/phase4-vertical-slice.test.ts]
- Navigate a browser to the printed URL. [ASSUMED]
- Assert no absolute path patterns appear in `document.body.innerText`, reusing Phase 4 privacy regexes. [VERIFIED: test/phase4-vertical-slice.test.ts, 04-UAT.md]
- Drive search by the visible search input placeholder or aria-label. [VERIFIED: FilterBar.test.tsx]
- Select a row by `data-testid="row-0"` or role row and assert `detail-panel` changes from empty to detail content. [VERIFIED: EventRow.tsx, DetailPanel.tsx]
- Append a valid JSONL event to the copied fixture and wait for row count/status bar to update. [ASSUMED]
- Switch themes and verify `document.documentElement.dataset.theme` plus persisted `localStorage["ahp-theme"]`. [VERIFIED: HeaderBar.tsx, main.tsx]

### Visual/UAT matrix

| Viewport | Theme(s) | Scenarios |
|---|---|---|
| 1366x768 | light/dark/hacker | Timeline with detail open, filter bar, header controls. [ASSUMED] |
| 1440x900 | light/dark/hacker | Baseline equivalent to Phase 4 UAT viewport. [VERIFIED: 04-UAT.md used 1440x900] |
| 1920x1080 | dark/hacker | Ultra-wide balance and payload column behavior. [ASSUMED] |
| 2560x1440 | light/dark/hacker | Ultra-wide balance and empty space review. [ASSUMED] |
| 1024-ish laptop threshold | all | Detail collapse/overlay behavior if implemented. [ASSUMED] |

### Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node | All scripts | ✓ | v22.22.2 | None needed. [VERIFIED: environment probe] |
| pnpm | Package scripts | ✓ | 9.15.0 | None needed. [VERIFIED: environment probe] |
| npm | npm registry checks | ✓ | 10.9.7 | None needed. [VERIFIED: environment probe] |
| playwright-cli | Manual browser UAT | ✓ | 0.1.12 | Add `@playwright/test` for automated E2E. [VERIFIED: environment probe] |
| `@playwright/test` | Recommended automated E2E | ✗ in project | 1.59.1 current registry | Use manual UAT + Vitest vertical slice if dependency rejected. [VERIFIED: package.json; npm registry] |
| `rg` | Fast code search | ✗ | - | Use `grep`/`find`. [VERIFIED: environment probe failed `rg`] |

**Missing dependencies with no fallback:** None for research/planning. [VERIFIED: environment probe]

**Missing dependencies with fallback:** `@playwright/test` is missing; fallback is manual `playwright-cli` UAT plus existing Vitest integration tests, but this is weaker for VERIFY-03. [VERIFIED: package.json; ASSUMED: adequacy risk]

## Risks and Mitigations

### Risk 1: Token drift through inline styles

**What goes wrong:** Components continue adding inline raw colors/shadows because the current guard only catches quoted hex. [VERIFIED: no-hex-in-components.test.ts, HeaderBar.tsx]
**Mitigation:** Expand the guard to catch raw color functions and move menu/panel shadows into tokens. [ASSUMED]
**Verification:** Static Vitest guard plus grep-style review. [ASSUMED]

### Risk 2: Hacker theme becomes novelty instead of usable

**What goes wrong:** Hacker mode may become low-contrast, distracting, or inaccessible if glow/scanlines overpower dense log data. [ASSUMED]
**Mitigation:** Keep effects subtle, token-driven, and reduced-motion aware; validate rows, JSON, filters, and banners in hacker mode. [ASSUMED]
**Verification:** Browser UAT screenshots and keyboard navigation smoke. [ASSUMED]

### Risk 3: Responsive detail panel crushes timeline

**What goes wrong:** Fixed timeline columns plus a fixed/clamped detail panel can exceed laptop viewport width. [VERIFIED: EventRow.tsx, AppShell.tsx, store.ts]
**Mitigation:** Introduce explicit breakpoints and a detail collapse/overlay behavior. [ASSUMED]
**Verification:** Browser viewport tests at laptop widths and UAT screenshots. [ASSUMED]

### Risk 4: jsdom gives false confidence for virtualized layout

**What goes wrong:** TanStack Virtual reads dimensions that jsdom reports as zero unless mocked. [VERIFIED: TimelineList.virt.test.tsx, .planning/STATE.md]
**Mitigation:** Keep dimension mocking for unit tests and use browser E2E/UAT for real layout behavior. [VERIFIED: TimelineList.virt.test.tsx; ASSUMED for E2E]

### Risk 5: localStorage migration or quota issues

**What goes wrong:** Adding preferences could corrupt or ignore existing saved state. [ASSUMED]
**Mitigation:** Keep current keys stable, validate schemas, handle invalid values, and test storage exceptions. [VERIFIED: main.tsx, persistence.ts, persistence.test.ts, persist-effect.test.ts]
**Verification:** jsdom storage tests plus reload E2E. [ASSUMED]

### Risk 6: Browser E2E flakiness

**What goes wrong:** Tests that wait for file append/live tail may race OS watchers. [ASSUMED]
**Mitigation:** Use copied fixture files, generous deterministic waits, server-visible status, and possibly direct HTTP/SSE assertions for tail readiness before browser assertions. [VERIFIED: Phase 4 vertical slice patterns; ASSUMED for browser test]
**Verification:** Run E2E locally and include trace/screenshot only on failure if using Playwright. [ASSUMED]

### Risk 7: Privacy regressions in visible UI

**What goes wrong:** E2E/UAT could expose absolute paths in picker, source strip, errors, or detail payloads. [VERIFIED: Phase 4 privacy gates and UAT review]
**Mitigation:** Reuse absolute-path regex assertions against HTTP/SSE bodies and browser body text. [VERIFIED: test/phase4-vertical-slice.test.ts, 04-UAT.md]
**Verification:** Include path-leak assertion in E2E and UAT checklist. [ASSUMED]

### Risk 8: New dependency conflicts with local-only posture

**What goes wrong:** Adding Playwright might be misconstrued as an outbound runtime dependency. [ASSUMED]
**Mitigation:** Keep Playwright dev-only; ensure app runtime remains local-only and no CDN/telemetry is added. [VERIFIED: package constraints; ASSUMED for dependency decision]
**Verification:** Existing security/CSP tests plus package review. [VERIFIED: test/security.test.ts, test/csp.test.ts listed]

## Open Questions / Decisions (RESOLVED)

1. **Should automated browser E2E add `@playwright/test` as a dev dependency?**
    - What we know: The project currently has no Playwright dependency/config, but global `playwright-cli` is available for manual UAT. [VERIFIED: package.json, environment probe]
    - RESOLVED: User confirmed `@playwright/test` is acceptable for this project.
    - Decision: Add `@playwright/test` as a dev dependency and keep Playwright test output local-only.

2. **What should happen to the detail panel at laptop widths?**
    - What we know: Current detail width defaults to 420px and clamps 360-720px; timeline columns are mostly fixed. [VERIFIED: store.ts, EventRow.tsx]
    - RESOLVED: User selected an overlay detail drawer so the timeline stays readable.
    - Decision: Below the approved desktop breakpoint, render details as an overlay drawer; keep the side rail for desktop/ultra-wide layouts.

3. **Are existing per-log preferences sufficient for "key viewer preferences"?**
    - What we know: Search, filters, grouping, collapsed groups, selected index, detail width, and livePaused already persist per log; theme persists globally. [VERIFIED: persistence.ts, main.tsx]
    - RESOLVED: Phase 5 should not add new preference controls.
    - Decision: Test and document existing per-log preferences, keep theme global, and do not persist drawer open/closed state or add density/column visibility/follow-latest preferences.

4. **Should hacker mode include motion?**
    - What we know: Existing global CSS respects reduced motion for spinner animation. [VERIFIED: global.css]
    - RESOLVED: User requested “go all out” hacker mode with CRT styling/effects where possible.
    - Decision: Add distinctive CRT/terminal effects with bounded opacity and `prefers-reduced-motion` safeguards that disable flicker, pulsing, drift, and other motion-heavy effects.

## Source Evidence with file paths

### Planning and constraints

- `.planning/ROADMAP.md` — Phase 5 goal, requirements, success criteria, and pending status. [VERIFIED]
- `.planning/REQUIREMENTS.md` — THEME-01 through THEME-05 and VERIFY-02/VERIFY-03 definitions. [VERIFIED]
- `.planning/STATE.md` — Phase 4 complete, Phase 5 next, architectural decisions, token/no-hex guard decision. [VERIFIED]
- `.planning/phases/04-live-tail-discovery-and-persistence/04-VERIFICATION.md` — Phase 4 passed, logKey propagation, persistence, UAT artifacts, final gate commands. [VERIFIED]
- `.planning/phases/04-live-tail-discovery-and-persistence/04-UAT.md` — prior browser/UAT approach, viewport, privacy review, Playwright tooling note. [VERIFIED]
- `.github/copilot-instructions.md` — local-only, host adapter, AHP source-of-truth, standalone-first constraints. [VERIFIED]

### Theme/style files

- `packages/ui/src/styles/tokens.css` — dark/light/hacker token blocks and JSON/chip/banner tokens. [VERIFIED]
- `packages/ui/src/styles/global.css` — imports tokens/fonts, body color-scheme, focus-visible, reduced-motion, JSON classes, unused `.detail-rail` responsive rule. [VERIFIED]
- `packages/ui/src/styles/fonts.css` — local Inter and JetBrains Mono fonts. [VERIFIED]
- `packages/ui/src/styles/no-hex-in-components.test.ts` — current raw quoted-hex component guard. [VERIFIED]
- `packages/ui/src/main.tsx` — initial theme load from `ahp-theme`, `data-theme` application. [VERIFIED]
- `packages/ui/src/components/shell/HeaderBar.tsx` — theme picker UI, persistence, raw rgba shadow gap. [VERIFIED]
- `packages/ui/src/components/shell/HeaderBar.test.tsx` — compact picker and light persistence coverage. [VERIFIED]

### Layout/component files

- `packages/ui/src/components/shell/AppShell.tsx` — shell composition, main flex split, detail wrapper, persistence mount. [VERIFIED]
- `packages/ui/src/components/timeline/EventRow.tsx` — fixed timeline grid columns and row token usage. [VERIFIED]
- `packages/ui/src/components/timeline/TimelineList.tsx` — virtualized grid and column header. [VERIFIED]
- `packages/ui/src/components/timeline/TimelineRegion.tsx` — empty/parse-error/disconnected/live-pause rendering and keyboard handling. [VERIFIED]
- `packages/ui/src/components/detail/DetailPanel.tsx` — detail panel width, states, Pretty/Raw tabs. [VERIFIED]
- `packages/ui/src/components/detail/DetailResizeHandle.tsx` — mouse/keyboard resize and min/max behavior. [VERIFIED]
- `packages/ui/src/components/detail/PrettyJsonView.tsx` — JSON class mapping and 256KB cap. [VERIFIED]
- `packages/ui/src/components/detail/RawJsonView.tsx` — safe `<pre>` raw JSON rendering. [VERIFIED]
- `packages/ui/src/components/filters/FilterBar.tsx` — nowrap filter row, popover z-index, group toggle, result counter. [VERIFIED]
- `packages/ui/src/components/states/NoActiveLogState.tsx` and `EmptyState.tsx` — no-log and empty layouts. [VERIFIED]

### State/persistence files

- `packages/ui/src/state/store.ts` — Zustand state, `detailWidth`, theme-adjacent persisted prefs, live tail state. [VERIFIED]
- `packages/ui/src/state/persistence.ts` — `ahp-log-prefs-v1` schema, LRU cap, validation. [VERIFIED]
- `packages/ui/src/persistence/persist-effect.ts` — hydrate/save timing and debounce behavior. [VERIFIED]
- `packages/ui/src/state/persistence.test.ts` and `packages/ui/src/persistence/persist-effect.test.ts` — storage behavior coverage. [VERIFIED]

### Test/config files

- `package.json` — root scripts and package manager. [VERIFIED]
- `packages/ui/package.json` — UI dependencies/scripts. [VERIFIED]
- `vitest.config.ts` — root Vitest include/pool config. [VERIFIED]
- `packages/ui/vitest.config.ts` — jsdom/react UI test config. [VERIFIED]
- `packages/ui/src/test-setup.ts` — jest-dom setup. [VERIFIED]
- `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` — virtualization test and jsdom dimension mocks. [VERIFIED]
- `packages/ui/src/components/timeline/TimelineRegion.test.tsx` — live pause, rotation, new events tests. [VERIFIED]
- `packages/ui/src/components/detail/DetailPanel.test.tsx` — detail panel state tests. [VERIFIED]
- `packages/ui/src/components/filters/FilterBar.test.tsx` — filter/search UI pieces. [VERIFIED]
- `packages/ui/src/components/states/states.test.tsx` — loading/empty/disconnected/server-not-running state tests. [VERIFIED]
- `test/sse-integration.test.ts` — server SSE snapshot/append/patch integration. [VERIFIED]
- `test/phase4-vertical-slice.test.ts` — CLI/discovery/session/tail/privacy vertical slice. [VERIFIED]
- `test/fixtures/*` — available scrubbed fixtures, including `phase3-mini.jsonl`, `phase2-mini.jsonl`, `malformed.jsonl`, and `long-realistic-ahp.jsonl`. [VERIFIED]

### External/version sources

- `npm view vitest version time.modified` → 4.1.5, modified 2026-05-05. [VERIFIED: npm registry]
- `npm view @testing-library/react version time.modified` → 16.3.2, modified 2026-01-19. [VERIFIED: npm registry]
- `npm view jsdom version time.modified` → 29.1.1, modified 2026-04-30. [VERIFIED: npm registry]
- `npm view @tanstack/react-virtual version time.modified` → 3.13.24, modified 2026-04-17. [VERIFIED: npm registry]
- `npm view react version time.modified` → 19.2.6, modified 2026-05-06. [VERIFIED: npm registry]
- `npm view react-json-view-lite version time.modified` → 2.5.0, modified 2025-09-06. [VERIFIED: npm registry]
- `npm view @playwright/test version time.modified` → 1.59.1, modified 2026-05-07. [VERIFIED: npm registry]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|
| A1 | Responsive layout is likely the highest implementation risk. | Executive Summary | Planner may over-prioritize layout before theme polish. |
| A2 | Phase 5 should use four/five waves with layout before final visual polish. | Executive Summary / Suggested Plan Breakdown | Different sequencing may be preferred by implementer. |
| A3 | Light theme needs contrast review across all surfaces. | Current State | Could spend effort where current visuals are already acceptable. |
| A4 | Hacker mode should add subtle token-driven effects. | Implementation Strategy | User may prefer a simpler hacker palette only. |
| A5 | `@playwright/test` should be added for repeatable VERIFY-03. | Standard Stack / Open Questions | User may reject new dev dependency. |
| A6 | Browser E2E should start CLI and append to a copied fixture. | Validation Architecture | Implementation may choose server-level E2E instead. |
| A7 | Detail panel should collapse or overlay at laptop widths. | Implementation Strategy / Open Questions | User may prefer horizontal scroll or always-visible detail. |
| A8 | Existing persisted viewer preferences are sufficient unless a new control is added. | Open Questions | User may expect additional preferences such as density/columns. |

## Metadata

**Confidence breakdown:**

- Current theme architecture: HIGH — directly verified in `main.tsx`, `HeaderBar.tsx`, `tokens.css`, and tests. [VERIFIED]
- Current layout architecture: HIGH — directly verified in `AppShell.tsx`, `EventRow.tsx`, `TimelineList.tsx`, `DetailPanel.tsx`, and `store.ts`. [VERIFIED]
- Test architecture: HIGH — directly verified in package scripts, Vitest configs, and test files. [VERIFIED]
- Recommended Playwright addition: MEDIUM — npm version verified, but dependency acceptance is a product/project decision. [VERIFIED: npm registry; ASSUMED]
- Visual polish recommendations: MEDIUM — based on current token/code inspection plus Phase 5 goals, but final aesthetics require human/browser review. [VERIFIED + ASSUMED]

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 for codebase-specific findings; 2026-05-15 for npm/browser tooling versions. [ASSUMED]
