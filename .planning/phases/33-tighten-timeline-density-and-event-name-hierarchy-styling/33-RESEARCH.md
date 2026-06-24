# Phase 33: Tighten timeline density and event-name hierarchy styling - Research

**Researched:** 2026-06-22
**Domain:** React virtualized timeline UI density, theme-token styling, event-label rendering
**Confidence:** HIGH

## User Constraints

No `33-CONTEXT.md` exists in the phase directory. [VERIFIED: codebase]

User request constraints:
- Make the app/timeline "a bit tighter" and "more data-dense," similar in spirit to the attached Chrome DevTools Network screenshot. [VERIFIED: user screenshot]
- Try slightly smaller font size and tighter rows, but preserve visual quality/readability. [VERIFIED: user request]
- For event names like `foo/bar`, subtly de-emphasize the prefix `foo/` while keeping it readable. [VERIFIED: user request]
- Preserve local-only/privacy posture: no telemetry, no CDN assets, no outbound network for viewing logs. [VERIFIED: .planning/STATE.md, README.md]

## Project Constraints

`copilot-instructions.md` does not exist in the repository root. [VERIFIED: codebase]
`.planning/REQUIREMENTS.md` does not exist. [VERIFIED: codebase]
Validation is enabled because `.planning/config.json` has `workflow.nyquist_validation: true`. [VERIFIED: .planning/config.json]
Security enforcement is not explicitly disabled, so include security checks. [VERIFIED: .planning/config.json]

## Summary

Phase 33 should be implemented entirely in the browser/client UI tier. The main surfaces are `EventRow.tsx`, `TimelineList.tsx`, `ParseErrorRow.tsx`, `LatencyCell.tsx`, and `tokens.css`. Current timeline rows are 28px tall, virtualizer estimates rows at 28px, and several row/header heights are duplicated as hardcoded numbers in `TimelineList.tsx`; density work must update these together to avoid scroll/overlap bugs. [VERIFIED: codebase]

The safest implementation is a token-first, timeline-local density change: reduce timeline row height from 28px to 24px, set row text explicitly through a row typography token, and keep group/header heights on the existing 4px grid. Event-name hierarchy should be rendered as React text spans, not HTML, using a new theme token for the prefix color across dark/light/hacker themes. [VERIFIED: codebase] [ASSUMED: recommended density target]

**Primary recommendation:** Use existing React/TanStack Virtual/tokens architecture; implement one small `EventNameLabel` renderer plus tokenized 24px timeline rows, then verify with unit style guards and fixture-only Playwright screenshots. [VERIFIED: codebase]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Timeline row density | Browser / Client | - | Row height, font size, padding, grid rendering, and virtualizer estimates live in UI components and CSS tokens. [VERIFIED: codebase] |
| Event-name prefix de-emphasis | Browser / Client | - | The Event column label is chosen and rendered in `EventRow.tsx`; no parser/core contract change is needed. [VERIFIED: codebase] |
| Theme coverage | Browser / Client | - | Dark/light/hacker themes are implemented via `tokens.css` and `data-theme`. [VERIFIED: codebase] |
| Screenshot verification | Browser / Client | CLI/server for fixture hosting | Existing E2E tests start the local CLI against synthetic fixtures and capture screenshots. [VERIFIED: e2e/phase31.spec.ts] |
| Privacy preservation | Browser / Client | CLI/server test harness | Existing screenshot tests assert no absolute path leakage and use synthetic/temp fixtures. [VERIFIED: e2e/phase31.spec.ts, test/fixture-scrub.test.ts] |

## Standard Stack

### Core

| Library / Surface | Project Version | Purpose | Why Standard |
|---|---:|---|---|
| React | 19.2.6 pinned | Component rendering and memoized timeline rows | Existing UI stack; React `memo` is already used for `EventRow`. [VERIFIED: package.json] |
| @tanstack/react-virtual | 3.13.24 pinned | Large timeline virtualization | Existing timeline virtualizer; docs prescribe `estimateSize`, `getTotalSize`, and absolutely positioned virtual rows. [VERIFIED: package.json] |
| Vitest + Testing Library | Vitest 4.1.5 pinned | Unit/component/style guards | Existing repo-wide test runner uses jsdom and setup files. [VERIFIED: package.json, vitest.config.ts] |
| Playwright | 1.59.1 pinned | Fixture browser screenshots and E2E checks | Existing phase screenshot specs use Playwright and local CLI fixtures. [VERIFIED: package.json, e2e/phase31.spec.ts] |
| tokens.css | internal | Theme and visual token source of truth | Project state says `tokens.css` is the single source for UI color/spacing/typography variables. [VERIFIED: .planning/STATE.md] |

### Supporting

| Surface | Purpose | When to Use |
|---|---|---|
| `no-hex-in-components.test.ts` | Reject raw hex/rgb/hsl literals outside tokenized styles | Add/verify event-prefix colors through tokens, not inline literals. [VERIFIED: codebase] |
| `theme-tokens.test.ts` | Ensures required theme token blocks cover dark/light/hacker | Extend if a new semantic event-prefix token is introduced. [VERIFIED: codebase] |
| `zLayers.ts` / `zLayers.test.ts` | Inline z-index scale mirrored to CSS tokens | Avoid introducing magic z-index values during visual polish. [VERIFIED: codebase] |

**Installation:** None. Use existing dependencies. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```text
JSONL log
  ↓
parser/core projection (`EventRow` data)
  ↓
Zustand store (`rows`, filters, selectedIdx)
  ↓
selectors (`useFilteredRows`, `useGroupedItems`)
  ↓
TimelineRegion
  ↓
TimelineList + TanStack Virtual
  ├─ sticky grid header
  ├─ GroupHeaderRow / ParseErrorRow
  └─ EventRow
       ├─ KindTag / DirectionGlyph / LatencyCell / SummaryCell
       └─ EventNameLabel (new)
```

[VERIFIED: codebase]

### Recommended Project Structure

```text
packages/ui/src/components/timeline/
├── EventRow.tsx                 # row layout + primary event label renderer
├── TimelineList.tsx             # virtualizer estimates + grid header/body
├── ParseErrorRow.tsx            # parse-error row height/padding parity
└── cells/
    └── EventNameLabel.tsx       # recommended small new component/helper
packages/ui/src/styles/
├── tokens.css                   # density/theme tokens
├── theme-tokens.test.ts         # token coverage guard
└── no-hex-in-components.test.ts # color literal guard
e2e/
└── phase33.spec.ts              # fixture-only screenshots and no-path-leak check
```

[VERIFIED: codebase] [ASSUMED: recommended new files]

### Pattern 1: Token-first density

**What:** Use tokenized row height and typography, and keep TanStack Virtual's `estimateSize` aligned with actual row height. [VERIFIED: codebase]

**Recommended target:** `--row-height: 24px`, row vertical padding `2px`, row font around `12px`, line-height around `16px`. [ASSUMED]

**Planner note:** Current code duplicates row height in:
- `tokens.css`: `--row-height: 28px` in dark/light/hacker blocks. [VERIFIED: codebase]
- `TimelineList.tsx`: `ITEM_HEIGHT.row = 28`, `parse-error = 28`, fallback 28, virtual row style `height: 28`. [VERIFIED: codebase]
- `EventRow.tsx` and `ParseErrorRow.tsx`: `height: var(--row-height)` and `padding: "4px 8px"`. [VERIFIED: codebase]
- `LatencyCell.tsx`: `height: var(--row-height)`. [VERIFIED: codebase]

### Pattern 2: Event-name hierarchy renderer

**What:** Split event labels at the last `/` and render the prefix with a subtle token color while keeping the leaf at normal emphasis. [VERIFIED: user request] [ASSUMED: last-slash split recommendation]

**When to use:** Only when the label has a slash with text on both sides; otherwise render existing label unchanged. [ASSUMED]

Implementation sketch:

```ts
function splitEventName(label: string): { prefix: string; leaf: string } | null {
  const slash = label.lastIndexOf("/");
  if (slash <= 0 || slash >= label.length - 1) {
    return null;
  }
  return { prefix: label.slice(0, slash + 1), leaf: label.slice(slash + 1) };
}
```

Use spans with token colors, not opacity:

```tsx
<span className="event-name">
  <span style={{ color: "var(--color-event-name-prefix)" }}>{prefix}</span>
  <span>{leaf}</span>
</span>
```

[ASSUMED: implementation recommendation]

### Pattern 3: Preserve search highlighting

Existing `EventRow.tsx` highlights search matches by returning React `<mark>` elements with token colors. [VERIFIED: codebase]
Do not regress that behavior when splitting prefix/leaf; either apply the existing highlighter separately to prefix and leaf, or build a small tokenization helper that knows both the prefix range and match ranges. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Large-log row virtualization | Custom visible-window math | Existing TanStack Virtual integration | The current tests prove <=100 DOM rows for 50k rows. [VERIFIED: TimelineList.virt.test.tsx] |
| Theme colors | Inline hex/rgb/hsl literals in components | `tokens.css` + semantic CSS vars | Guard test rejects raw color literals outside tokenized styles. [VERIFIED: no-hex-in-components.test.ts] |
| Event label HTML | `dangerouslySetInnerHTML` | React text spans | Event labels come from logs and must stay escaped. [VERIFIED: codebase] |
| Screenshot fixtures | Real/private logs | Existing synthetic fixtures / temp JSONL | Fixture scrubber forbids paths, tokens, emails, host/user names. [VERIFIED: test/fixture-scrub.test.ts] |
| Z-index layering | Magic z-index numbers | `Z` constants / `--z-*` tokens | Phase 32 introduced guarded z-index scale. [VERIFIED: zLayers.ts, zLayers.test.ts] |

## Common Pitfalls

### Pitfall 1: Row height / virtualizer mismatch

**What goes wrong:** Visual rows overlap, scroll positions drift, or tail-follow behaves incorrectly.
**Why it happens:** Actual CSS row height and `estimateSize` / virtual row height differ. [VERIFIED: codebase]
**How to avoid:** Update `--row-height`, `ITEM_HEIGHT`, virtual style height, parse-error rows, and latency cell together. [VERIFIED: codebase]

### Pitfall 2: Global typography shrinkage

**What goes wrong:** Filter controls, detail pane, picker rows, and timeline all shrink unexpectedly. [VERIFIED: codebase]
**Why it happens:** `--text-row-size` is reused outside timeline rows. [VERIFIED: codebase]
**How to avoid:** Prefer timeline-specific styling or audit every `--text-row-size` use before changing the token globally. [VERIFIED: codebase]

### Pitfall 3: Prefix color too faint in Hacker or Light

**What goes wrong:** `foo/` becomes decorative but not readable. [VERIFIED: user request]
**Why it happens:** `--color-text-subtle` is much lower-emphasis than `--color-text-muted` in all themes. [VERIFIED: tokens.css]
**How to avoid:** Add a semantic `--color-event-name-prefix` token per theme, likely closer to muted/text mix than subtle. [ASSUMED]

### Pitfall 4: Breaking React memo benefits

**What goes wrong:** Timeline rows re-render on unrelated state changes. [VERIFIED: EventRow.memo.test.tsx]
**Why it happens:** React `memo` shallowly compares props, so fresh object/function props defeat memoization.
**How to avoid:** Keep new event-label rendering inside `EventRow` or pass primitive props only. [VERIFIED: codebase]

### Pitfall 5: Screenshot privacy leak

**What goes wrong:** Saved screenshots expose private absolute paths or real-log text. [VERIFIED: README.md, e2e/phase31.spec.ts]
**Why it happens:** Using real local logs for visual evidence. [VERIFIED: README.md]
**How to avoid:** Use synthetic/temp fixtures and assert no `/Users/`, `/home/`, or Windows paths before screenshots. [VERIFIED: e2e/phase31.spec.ts]

## Code Examples

### Event label split helper

```ts
export function splitHierarchicalEventName(label: string):
  | { prefix: string; leaf: string }
  | null {
  const slash = label.lastIndexOf("/");
  if (slash <= 0 || slash >= label.length - 1) {
    return null;
  }
  return { prefix: label.slice(0, slash + 1), leaf: label.slice(slash + 1) };
}
```

[ASSUMED: recommended helper]

### Density constants to align

```ts
const ITEM_HEIGHT = {
  row: 24,
  "parse-error": 24,
  header: 24,
} as const;
```

[ASSUMED: recommended target] [VERIFIED: existing ITEM_HEIGHT pattern]

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Raw component colors | Tokenized theme colors with guard test | Add prefix color only via tokens. [VERIFIED: no-hex-in-components.test.ts] |
| Magic z-indexes | Guarded `Z` scale + CSS vars | Do not add raw z-index values. [VERIFIED: zLayers.ts] |
| Duplicate heavy selector work | Single-entry memoized selectors after Phase 32 | Avoid broad row prop churn. [VERIFIED: selectors.ts] |
| Full DOM timeline | TanStack Virtual visible rows | Density changes must preserve virtualizer alignment. [VERIFIED: TimelineList.tsx] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | 24px row height, 12px-ish row font, and 16px line-height are the right "slightly tighter" target. | Summary / Patterns | User may prefer more or less density. |
| A2 | Event labels should split at the last slash, so `foo/bar/baz` renders `foo/bar/` muted and `baz` primary. | Event-name hierarchy | User may expect only first segment muted. |
| A3 | Event-name prefix should apply to both `method` and `actionType` primary labels. | Event-name hierarchy | User may intend action names only. |

## Open Questions (RESOLVED)

1. **Exact density target — RESOLVED**
   - What we know: current rows are 28px high. [VERIFIED: codebase]
   - Resolution: implement a fixed 24px timeline row target, not a density toggle, and validate with fixture-only screenshots. [RESOLVED]
   - Rationale: 24px is a modest 4px-grid reduction that moves toward DevTools density while preserving readability. [ASSUMED]

2. **Slash hierarchy rule — RESOLVED**
   - What we know: user gave `foo/bar` and wants `foo/` subtly grayed. [VERIFIED: user request]
   - Resolution: split at the last slash, so `foo/bar/baz` renders prefix `foo/bar/` and leaf `baz`. [RESOLVED]
   - Rationale: this keeps the final event/action leaf as the strongest scanning anchor. [ASSUMED]

3. **Scope of "app tighter" — RESOLVED**
   - What we know: research focus is timeline/table/list density. [VERIFIED: user prompt]
   - Resolution: tighten timeline rows and timeline headers only; do not shrink filter controls, picker rows, detail pane, or body text. [RESOLVED]
   - Rationale: this addresses the data-dense table request without a broad app typography regression. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | build/test/e2e | yes | v24.15.0 | Must be >=22. [VERIFIED: local probe, package.json] |
| pnpm | package scripts | yes | 9.15.0 | npm not recommended because lock/workspace is pnpm. [VERIFIED: local probe, package.json] |
| Vitest | unit/style/component tests | yes | 4.1.5 | none needed. [VERIFIED: local probe] |
| Playwright | E2E screenshots | yes | 1.59.1 | fixture unit tests if browser unavailable, but screenshots require Playwright. [VERIFIED: local probe] |
| tsx | CLI fixture server in E2E | yes | 4.21.0 local binary | build CLI first if needed. [VERIFIED: local probe] |

**Missing dependencies with no fallback:** None found. [VERIFIED: local probe]
**Missing dependencies with fallback:** None found. [VERIFIED: local probe]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.5 + jsdom; Playwright 1.59.1 for E2E. [VERIFIED: local probe] |
| Config file | `vitest.config.ts`, `playwright.config.ts`. [VERIFIED: codebase] |
| Quick run command | `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx packages/ui/src/components/timeline/TimelineList.virt.test.tsx packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` |
| Full suite command | `pnpm test && pnpm -F @ahp-inspector/ui build && pnpm typecheck && pnpm lint` |

### Proposed Phase Behaviors -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| DENSITY-33-01 | Timeline rows use the tighter row height and virtualizer estimate matches rendered height. | unit/style | `pnpm vitest run packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | update |
| EVENTNAME-33-02 | `foo/bar` renders prefix and leaf with separate styling while preserving accessible label/title. | component | `pnpm vitest run packages/ui/src/components/timeline/EventRow.columns.test.tsx` | update |
| THEME-33-03 | Prefix color token exists for dark/light/hacker and no raw component colors are introduced. | style guard | `pnpm vitest run packages/ui/src/styles/theme-tokens.test.ts packages/ui/src/styles/no-hex-in-components.test.ts` | update |
| PRIVACY-33-04 | Screenshots use synthetic fixtures and contain no absolute path leakage. | e2e | `pnpm e2e -- e2e/phase33.spec.ts` | Wave 0 |

### Wave 0 Gaps

- [ ] Add/extend `EventRow.columns.test.tsx` for hierarchical event-name spans. [VERIFIED: existing test file]
- [ ] Add/extend `TimelineList.virt.test.tsx` for 24px row estimate/style alignment. [VERIFIED: existing test file]
- [ ] Add `e2e/phase33.spec.ts` for fixture-only dark/light/hacker screenshots. [ASSUMED]
- [ ] Extend `theme-tokens.test.ts` if adding `--color-event-name-prefix`. [VERIFIED: existing test file]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---:|---|
| V2 Authentication | no | No auth behavior changes. [VERIFIED: phase scope] |
| V3 Session Management | no | No session behavior changes. [VERIFIED: phase scope] |
| V4 Access Control | no | No server/API access changes. [VERIFIED: phase scope] |
| V5 Input Validation | yes | Treat log-derived event labels as text; render via React text nodes only. [VERIFIED: codebase] |
| V6 Cryptography | no | No cryptography changes. [VERIFIED: phase scope] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| XSS via log-derived event names | Tampering / Elevation | Use React text spans; never use `dangerouslySetInnerHTML`. [VERIFIED: codebase] |
| Sensitive data in screenshots | Information Disclosure | Use synthetic fixtures/temp files and `assertNoPathLeak`. [VERIFIED: e2e/phase31.spec.ts] |
| Large-log UI DoS from virtualization regression | Denial of Service | Keep TanStack Virtual and existing <=100 DOM-row test. [VERIFIED: TimelineList.virt.test.tsx] |
| Theme contrast regression | Information Disclosure / Usability | Tokenize per-theme prefix color and verify all theme blocks. [VERIFIED: theme-tokens.test.ts] |

## Sources

### Primary

- `packages/ui/src/components/timeline/EventRow.tsx` - event label, row style, cells. [VERIFIED: codebase]
- `packages/ui/src/components/timeline/TimelineList.tsx` - virtualizer, row/header heights, grid columns. [VERIFIED: codebase]
- `packages/ui/src/styles/tokens.css` - dark/light/hacker tokens and row typography/height. [VERIFIED: codebase]
- `packages/ui/src/styles/no-hex-in-components.test.ts` - raw color guard. [VERIFIED: codebase]
- `packages/ui/src/styles/theme-tokens.test.ts` - required theme token guard. [VERIFIED: codebase]
- `e2e/phase31.spec.ts`, `e2e/phase5.spec.ts` - fixture screenshot and privacy patterns. [VERIFIED: codebase]

### Secondary

- `.planning/STATE.md`, `.planning/ROADMAP.md` - project constraints, Phase 32 dependency, local-only posture. [VERIFIED: codebase]
- README.md - local-first/privacy posture and dense virtualized timeline description. [VERIFIED: codebase]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing package pins and npm registry verified.
- Architecture: HIGH - implementation surfaces are directly verified in code.
- Pitfalls: HIGH - derived from existing tests, Phase 32 changes, and virtualizer docs.
- Exact visual density target: MEDIUM - current values are verified, but 24px/12px is a recommendation requiring visual review.

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 for codebase surfaces; re-check npm/docs if dependencies change.
