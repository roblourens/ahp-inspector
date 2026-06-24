# Phase 33: Tighten timeline density and event-name hierarchy styling - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 13
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/ui/src/components/timeline/EventRow.tsx` | component | transform / event-driven | `packages/ui/src/components/timeline/EventRow.tsx` | exact |
| `packages/ui/src/components/timeline/cells/EventNameLabel.tsx` | component | transform | `packages/ui/src/components/timeline/cells/SummaryCell.tsx` + `EventRow.tsx` | role-match |
| `packages/ui/src/components/timeline/TimelineList.tsx` | component | streaming / event-driven | `packages/ui/src/components/timeline/TimelineList.tsx` | exact |
| `packages/ui/src/components/timeline/ParseErrorRow.tsx` | component | transform | `packages/ui/src/components/timeline/ParseErrorRow.tsx` | exact |
| `packages/ui/src/components/timeline/cells/LatencyCell.tsx` | component | transform | `packages/ui/src/components/timeline/cells/LatencyCell.tsx` | exact |
| `packages/ui/src/styles/tokens.css` | config | transform | `packages/ui/src/styles/tokens.css` | exact |
| `packages/ui/src/styles/theme-tokens.test.ts` | test | batch / static-analysis | `packages/ui/src/styles/theme-tokens.test.ts` | exact |
| `packages/ui/src/styles/no-hex-in-components.test.ts` | test | batch / static-analysis | `packages/ui/src/styles/no-hex-in-components.test.ts` | exact |
| `packages/ui/src/components/timeline/EventRow.columns.test.tsx` | test | transform | `packages/ui/src/components/timeline/EventRow.columns.test.tsx` | exact |
| `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | test | streaming / event-driven | `packages/ui/src/components/timeline/TimelineList.virt.test.tsx` | exact |
| `packages/ui/src/components/timeline/ParseErrorRow.test.tsx` | test | transform | `packages/ui/src/components/timeline/ParseErrorRow.test.tsx` | exact |
| `packages/ui/src/components/timeline/cells/LatencyCell.test.tsx` | test | transform | `packages/ui/src/components/timeline/cells/LatencyCell.test.tsx` | exact |
| `e2e/phase33.spec.ts` | test | file-I/O / request-response | `e2e/phase31.spec.ts` | role-match |

## Pattern Assignments

### `EventRow.tsx`

Existing patterns:
- Imports `EventRowData`, `ShieldAlert`, React `memo`/`useCallback`, and timeline cell components.
- `highlightMatches(text, query)` safely returns React text spans and `<mark>` nodes, using `var(--color-search-match-bg)` and `var(--color-search-match-fg)`.
- Row style is an inline grid with `height: "var(--row-height)"`, `boxSizing: "border-box"`, and tokenized backgrounds for selected, pair-highlighted, and search-match states.
- Primary label cell uses `title={labelTitle}`, flex alignment, `gap: "var(--space-1)"`, `fontWeight: label ? 600 : 400`, truncation, and `highlightMatches(label, searchQuery)`.
- `EventRow` is memoized; `handleClick` is stable via `useCallback`.

Apply to Phase 33:
- Keep `EventRow` memoized.
- Add/import a small `EventNameLabel` without passing fresh object/function props.
- Preserve full unsplit `title={labelTitle}` and accessible row labeling.
- Preserve search highlighting with React nodes; never use HTML injection.
- Tighten row padding in parity with `--row-height: 24px`.

### `cells/EventNameLabel.tsx`

Closest analogs:
- `SummaryCell.tsx`: small standalone cell component returning a tokenized `<span>`, with `data-testid`, truncation, `display: "inline-block"`, and `maxWidth: "100%"`.
- `KindTag.tsx`: tokenized inline style and data attributes.
- `EventRow.tsx`: search highlighting logic.

Apply to Phase 33:
- Create a small component/helper that splits only at the last slash when both prefix and leaf are non-empty.
- Render `foo/bar/baz` as prefix `foo/bar/` and leaf `baz`.
- Do not split no-slash, leading-slash-only, or trailing-slash-only labels.
- Prefix color must be `var(--color-event-name-prefix)`.
- Leaf inherits normal event-name color and should remain the visual anchor.
- Preserve search `<mark>` rendering across prefix and leaf.

### `TimelineList.tsx`

Existing patterns:
- `ITEM_HEIGHT` currently defines `row: 28`, `"parse-error": 28`, `header: 24`.
- TanStack Virtual `estimateSize` falls back to `28`.
- Sticky column header is `height: 24`, `padding: "3px 8px"`, uses `Z.sticky`, `var(--color-surface)`, `var(--color-border)`, and uppercase muted text.
- Rendered virtual row style currently sets `height: 28`.

Apply to Phase 33:
- Update `ITEM_HEIGHT.row`, `ITEM_HEIGHT["parse-error"]`, virtualizer fallback, and rendered row style height together from `28` to `24`.
- Keep `header: 24` unchanged.
- Do not replace TanStack Virtual or alter tail-follow, grouping, row selection, pair highlighting, or search navigation behavior.

### `ParseErrorRow.tsx`

Existing patterns:
- Inline grid row with `height: "var(--row-height)"`, `padding: "4px 8px"`, and selected background.
- Rail uses `repeating-linear-gradient(... var(--color-destructive) ...)`.
- Copy remains `BAD · line {line} · {reason}` with destructive color.

Apply to Phase 33:
- Keep `height: "var(--row-height)"`.
- Tighten padding in parity with `EventRow`.
- Preserve destructive rail/copy semantics.

### `cells/LatencyCell.tsx`

Existing patterns:
- Height is tokenized with `height: "var(--row-height)"`.
- Bar uses `var(--latency-${band})`.

Apply to Phase 33:
- Keep height tokenized; do not hardcode `24px` in the component.
- Optional test can assert `latency-cell.style.height` contains `--row-height`.

### `tokens.css`

Existing patterns:
- Each theme block declares spacing, `--row-height: 28px`, typography tokens, text tokens, and fixed-height tokens.
- Text token neighborhoods:
  - dark: `--color-text`, `--color-text-muted`, `--color-text-subtle`, `--color-text-disabled`
  - light: same token names
  - hacker: same token names
- Existing fixed-height tokens include `--row-group-header-height: 24px`.

Apply to Phase 33:
- Set `--row-height: 24px` in dark, light, and hacker blocks.
- Add `--color-event-name-prefix` in all three theme blocks near text tokens.
- Recommended value: `color-mix(in srgb, var(--color-text-muted) 70%, var(--color-text) 30%)`.
- Keep component colors tokenized; do not add raw hex/rgb/hsl literals in React components.

### `theme-tokens.test.ts`

Existing patterns:
- `REQUIRED_THEME_TOKENS` lists every semantic token required in dark/light/hacker blocks.
- `blockFor(selector)` scans each theme block and fails with missing token names.

Apply to Phase 33:
- Add `--color-event-name-prefix` to `REQUIRED_THEME_TOKENS`.

### `no-hex-in-components.test.ts`

Existing patterns:
- Scans source files and rejects raw hex/rgb/hsl literals outside tokenized styles.
- Allows only legitimate exceptions such as CRT SVG filter math.

Apply to Phase 33:
- Do not add raw color literals in timeline components.
- Use `var(--color-event-name-prefix)` in component styles.

### `EventRow.columns.test.tsx`

Existing patterns:
- Typed `EventRowData` base fixture.
- Override only fields relevant to each scenario.
- Assert visible text, `title`, inline style, roles, and data attributes.

Apply to Phase 33:
- Add tests that `foo/bar` renders distinct prefix and leaf spans.
- Add deeper-name test: `foo/bar/baz` splits into `foo/bar/` + `baz`.
- Add non-split cases: no slash, leading slash only, trailing slash only.
- Assert full title/accessibility remains the unsplit event label.
- Assert search highlighting still produces `<mark>` across prefix/leaf.

### `TimelineList.virt.test.tsx`

Existing patterns:
- 50,000-row typed fixture.
- jsdom virtualizer mocks `getBoundingClientRect`, `offsetHeight`, and `offsetWidth`.
- Asserts the rendered DOM row count stays below 100.

Apply to Phase 33:
- Add/update assertions that row and parse-error rendered heights are `24px`.
- Ensure header remains `24px`.
- Keep large-log virtualization assertion.

### `ParseErrorRow.test.tsx`

Existing patterns:
- Typed parse-error fixture.
- Asserts verbatim `BAD · line 5 · expected token`.
- Asserts destructive rail gradient token.

Apply to Phase 33:
- Optional density assertion: row style keeps `height: var(--row-height)` and compact padding.

### `LatencyCell.test.tsx`

Existing patterns:
- Simple render tests for ms, seconds, and null dash.

Apply to Phase 33:
- Optional density parity assertion: `screen.getByTestId("latency-cell").style.height` contains `--row-height`.

### `e2e/phase33.spec.ts`

Closest analog: `e2e/phase31.spec.ts`.

Existing patterns to reuse:
- Spawn CLI with `tsx packages/cli/src/index.ts`, `BROWSER=none`, `--port 0`, `--no-open`.
- Wait for `AHP Inspector running at http://127.0.0.1:{port}`.
- Use synthetic temp JSONL fixtures.
- Capture screenshots under a phase-specific directory.
- `assertNoPathLeak(page)` rejects `/Users/`, `/home/`, and Windows path text before screenshots.
- Switch themes using the Theme picker and assert `html[data-theme]`.
- Clean up temp directory and CLI process.

Apply to Phase 33:
- Use `screenshots/phase33`.
- Include synthetic hierarchical event names: `foo/bar`, `foo/bar/baz`, no-slash, leading slash, trailing slash.
- Capture dark/light/hacker screenshots from fixtures only.

## Shared Rules

### Token-first color and density

- Component color must be `var(--color-event-name-prefix)`, not raw hex/rgb/hsl.
- Add the prefix token to all dark/light/hacker theme blocks.
- Add the prefix token to `REQUIRED_THEME_TOKENS`.

### Virtualizer height alignment

- `--row-height`, `ITEM_HEIGHT.row`, `ITEM_HEIGHT["parse-error"]`, fallback estimates, and rendered row style height must all agree.
- Header/group header remains `24px`.

### React text safety / no HTML injection

- Use React text nodes and `<span>/<mark>` elements only.
- Never use `dangerouslySetInnerHTML`.
- Preserve search highlighting across prefix and leaf.

### Component test fixture style

- Construct typed `EventRowData` fixtures.
- Override only fields relevant to the scenario.
- Assert roles, text, `title`, style, and data attributes directly.

### E2E fixture privacy

- Use synthetic temp JSONL fixtures.
- Assert no `/Users/`, `/home/`, or Windows path leakage before screenshots.
- Clean up temp directory and CLI process.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| None | - | - | Every planned file has an exact or close role/data-flow analog. |

## Metadata

**Analog search scope:**
- `packages/ui/src/components/timeline/**`
- `packages/ui/src/styles/**`
- `e2e/*.spec.ts`

**Files scanned:** 45
**Pattern extraction date:** 2026-06-23

## Structured Summary

**Phase:** 33 - Tighten timeline density and event-name hierarchy styling
**Files classified:** 13
**Analogs found:** 13 / 13

### Coverage

- Files with exact analog: 11
- Files with role-match analog: 2
- Files with no analog: 0

### Key Patterns Identified

- Timeline components use tokenized inline styles, CSS variables, React memoization, and ARIA grid roles.
- Row density must be updated across `tokens.css`, `TimelineList` virtualizer estimates, rendered row style height, parse-error rows, and latency cells together.
- Event labels/search highlighting are React text/element transforms; do not use HTML injection.
- Theme changes are guarded by `theme-tokens.test.ts` and raw component colors by `no-hex-in-components.test.ts`.
- E2E screenshots use synthetic temp fixtures, local CLI spawn, theme switching, and path-leak assertions.
