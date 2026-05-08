---
phase: 3
slug: detail-search-and-filtering
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-07
reviewed_at: 2026-05-07
extends: ../02-vertical-slice-cli-server-timeline/02-UI-SPEC.md
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for the second slice: a real **detail panel**, a **search + filter bar**, **session/turn grouping**, and surfaced **serverSeq gaps + auth failures**. This phase **extends** the Phase 2 token foundation (tokens.css) and component surface — it does not redefine spacing, type, surface palette, or row geometry. Anything not respecified here MUST follow Phase 2's contract verbatim.

---

## 0. Scope and Boundaries

**In scope (Phase 3):**

- **Detail panel** that replaces `DetailRailPlaceholder`: summary table, correlation metadata, AHP-specific field strip (DETAIL-04), Pretty / Raw JSON tabs, copy actions, truncation banner, privacy caption, resizable 360–600 px width.
- **Filter bar** above the timeline: free-text search input, facet chips for direction / kind / method / actionType / session / turn / status / time-range, active-filter chip row, "Clear all" button, result counter.
- **Grouping** toggle (None / Session / Session+Turn) and group-header rendering inside the virtualized list, with a sticky "current group" chrome bar above the list.
- **Selection behavior** preserved across filter/search changes (selection is keyed by `EventRow.idx`, never by visible position).
- **Keyboard model** extended: `/` focuses search, `f` opens filter menu, `Esc` collapses in priority order (clear search → close popover → clear filters → clear selection), Up/Down/PageUp/PageDown/Home/End operate over the **filtered + grouped** view.
- **EVENT-06 surfaces:** inline `gap-banner` row between events when `gapBefore: true`; auth-failure rail color + detail-panel banner when `isAuthFailure: true`.
- **Empty / no-results states** for filtered or searched views.
- **Browser UAT screenshot expectations** (§13).

**Explicitly out of scope (deferred):**

- Filter persistence across reloads → **Phase 4** (SEARCH-05).
- Live-tail follow toggle, "jump to live" pill, new-event count → **Phase 4**.
- File-open dialog, log discovery → **Phase 4**.
- Light / hacker themes, theme switcher → **Phase 5**.
- Shiki token-level syntax highlighting → **Phase 5 polish** (DETAIL-03 satisfied by `react-json-view-lite` key/value styling in Phase 3; flagged in 03-RESEARCH §Open Questions Q1).
- Saved searches, named filter presets, regex / DSL → **v2** (ADV-02, ADV-06).
- Settings panel, command palette → **Phase 5+**.

**Phase 2 contracts that REMAIN locked and unchanged:**

- Spacing scale (`--space-0..8`, `--row-height: 28px`).
- Typography roles (4 sizes, 2 weights), mono-vs-sans rules.
- Surface palette (60/30/10), accent reservation, semantic state colors.
- Row geometry, columns 1–11, row states (default/hover/selected/focused/parse-error/orphan/failed/pending).
- Direction glyphs, KindTag pills, ActionDot, LatencyCell bands, StatusCell rendering.
- App-shell chrome (header bar 40 px, source strip 32 px, status bar 24 px).
- All Phase 2 copy strings (§10 of 02-UI-SPEC).

---

## 1. Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none (custom CSS variables, no shadcn) | inherited |
| Component library | hand-built primitives in `packages/ui/src/components/` | inherited |
| Icon library | `lucide-react` (tree-shaken, self-bundled) | inherited |
| New runtime dep | `react-json-view-lite@2.5.0` (collapsible JSON tree, ~5 KB, no `eval`/`Function`) | 03-RESEARCH §Standard Stack |
| Asset policy | unchanged — local-only, CSP `connect-src 'self'`, no CDN | inherited |
| Theme attribute | `<html data-theme="dark">` only — Phase 5 owns light/hacker | inherited |

**Why not Radix Popover/Tabs for filters/detail:** the filter facet menus in Phase 3 are rectangular checkbox lists that close on click-outside, the detail tabs are a pair of buttons toggling a `role="tabpanel"` — both are <60 lines of hand-rolled code. We resist taking on Radix until at least three independent components need it (Phase 5 may revisit).

---

## 2. Spacing — Phase 3 additions

No new spacing tokens. All Phase 3 components compose Phase 2's `--space-1..8` scale plus the documented `--row-height: 28px` exception. Group headers and the gap-banner row introduce two new fixed heights (still on the 4 px grid):

| New fixed height | Value | CSS variable | Usage |
|------------------|-------|--------------|-------|
| Group header | 24 px | `--row-group-header-height` | Session / Turn group title bar inside the virtualized list |
| Gap-banner row | 20 px | `--row-banner-height` | Inline `serverSeq gap` notice between events |
| Filter bar | 40 px | `--filter-bar-height` | Sticky chrome row above the timeline region |
| Active-chips row | 32 px | `--filter-chips-height` | Only rendered when `activeFilters.length + (query!=='' ? 1 : 0) > 0` |
| Detail panel header | 40 px | (reuses `--filter-bar-height`) | Summary heading + Pretty/Raw tab strip |

All 24/20/40/32 land on the 4 px grid. No `padding`/`margin` literal `px` values may appear in component source except `1px`/`2px` for borders/rails (inherited Phase 2 rule).

---

## 3. Typography — Phase 3 additions

No new type roles. Phase 3 components use only the six Phase 2 roles (`text-row`, `text-row-strong`, `text-ui`, `text-ui-muted`, `text-heading`, `text-body`).

**Field-strip key:value table in Detail panel** uses `text-ui-muted` (12 px sans) for keys and `text-row` (13 px mono) for values. **Search input** uses `text-row` (13 px mono) so paste-from-log feels native. **Filter chips** use `text-ui-muted` (12 px sans). **Group headers** use `text-ui` (13 px sans, weight 600). **Result counter** uses `text-ui-muted`.

Locked: still exactly four sizes (12/13/14/16) and two weights (400/600). No italics. No underline except `:focus-visible` on inline links and the `Clear all` text button.

---

## 4. Color — Phase 3 additions

Phase 3 introduces three new token namespaces, all written into `tokens.css` under the existing `[data-theme="dark"]` block. Phase 5 must override them when adding light/hacker.

### 4.1 Search highlight

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Search-match background | `--color-search-match-bg` | `#3a3520` (low-chroma amber, ~AA on `--color-text`) | Inline `<mark>` background inside payload preview, summary table, and JSON value strings when query length ≥ 2 |
| Search-match foreground | `--color-search-match-fg` | `#e6e9ef` | Forced foreground on `<mark>` so contrast is preserved across themes |

Highlights are applied **only** to text the search query actually matched (substring), never to the row as a whole. Row-level "this row matched" is signaled by the row remaining visible — no extra row tint, to keep the timeline visually quiet.

### 4.2 Filter / chip surfaces

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Chip surface (idle) | `--color-chip-bg` | `#1c2129` (= `--color-surface-raised`) | Resting facet button and active-filter chip background |
| Chip surface (active) | `--color-chip-bg-active` | `#262c36` (= `--color-border`) | Facet button when popover is open, or chip representing an active filter value |
| Chip border | `--color-chip-border` | `var(--color-border-strong)` | 1 px chip border |
| Chip foreground | `--color-chip-fg` | `var(--color-text)` | Chip label |
| Chip muted foreground | `--color-chip-fg-muted` | `var(--color-text-muted)` | Chip count badge ("Direction · 2") |
| Chip dismiss glyph | `--color-chip-dismiss` | `var(--color-text-muted)` → `var(--color-destructive)` on hover/focus | The `×` button on an active-filter chip |

Chips never use `--color-accent` for fill. Accent on chips is reserved for the **focus ring** only.

### 4.3 Detail panel field-strip emphasis (DETAIL-04)

The AHP-specific field strip highlights nine canonical fields when present. Each gets a left-edge accent stripe (2 px) using its semantic color. **Color is decorative only**; the field name (key column) is always present as text.

| Field | Token used for stripe | Rationale |
|-------|-----------------------|-----------|
| `session` | `--color-info` (`#7DCFFF`) | Stable identity color across the app |
| `turn` | `--color-info` | Same family as session, intentional |
| `toolCall` | `--action-tool-call` (`#7AA2F7`) | Reuses Phase 2 action-taxonomy |
| `actionType` | `--action-text` (`#7DCFA4`) | Reuses Phase 2 action-taxonomy default |
| `serverSeq` | `--color-text-muted` | Numeric metadata; not high-priority unless gap |
| `origin` | `--color-text-muted` | Metadata |
| `requestId` | `--kind-request` (`#7AA2F7`) | Mirrors KindTag |
| `errorCode` | `--color-destructive` | Critical |
| `notificationType` | `--kind-notification` (`#E0AF68`) | Mirrors KindTag |

When a field is absent on the selected event, the row is omitted entirely from the strip — never rendered as `—`. The strip therefore varies in row count from 0 to 9.

### 4.4 Group header / gap / auth surfaces (TIME-05, EVENT-06)

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Group-header background | `--color-group-header-bg` | `#1a1f27` (= midpoint of `--color-surface` and `--color-surface-raised`) | Session / Turn header bar inside the list |
| Group-header foreground | `--color-group-header-fg` | `var(--color-text)` | Group title |
| Group-header chip | `--color-group-header-meta` | `var(--color-text-muted)` | Event count + duration on the right side of the header |
| Gap-banner background | `--color-gap-banner-bg` | `color-mix(in srgb, var(--color-warning) 14%, var(--color-bg))` | Inline serverSeq gap banner |
| Gap-banner foreground | `--color-gap-banner-fg` | `var(--color-warning)` | Banner glyph + label |
| Auth-failure rail | `--color-auth-fail-rail` | `var(--color-destructive)` | Row left rail + detail-panel top banner background-tint |
| Auth-failure banner background | `--color-auth-fail-banner-bg` | `color-mix(in srgb, var(--color-destructive) 14%, var(--color-bg))` | Detail-panel auth banner |

**Color-only rule (Phase 2 §4.5) preserved:** every semantic surface above is paired with text or a glyph (`⚠` for gap, `🔒`/`SHIELD` lucide for auth, capital labels for groups).

---

## 5. Layout — App Shell (Phase 3)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header bar (40px)         AHP Log Viewer · v0.3                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source strip (32px)       📄 sample.jsonl · 12,431 events · 3 sessions       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filter bar (40px)  [🔍 Search method, id, payload…] [Dir▾] [Kind▾]           │
│                    [Method▾] [Action▾] [Session▾] [Turn▾] [Status▾] [Time▾]  │
│                    [Group: None ▾]                              12,431/12,431│
├──────────────────────────────────────────────────────────────────────────────┤
│ Active chips (32px, only when active)                                        │
│   Dir: c2s ×   Kind: REQ, RES ×   Status: error ×       [Clear all]          │
├────────────────────────────────────────────────┬─────────────────────────────┤
│  Sticky group header (24px, only when grouped) │  Detail panel               │
│  ▾ Session a3f2…be  · 412 events · 2.4s        │  (resizable 360–600px)      │
│ ──────────────────────────────────────────────│                             │
│  Timeline region                               │  ┌─ Summary ──────────┐     │
│  Row 1  → REQ initialize        12ms  200      │  │ ts · dir · kind …  │     │
│  Row 2  ← RES initialize        —     OK       │  └────────────────────┘     │
│  ⚠ serverSeq gap: 12 → 17                       │  ┌─ AHP Fields ───────┐     │
│  Row 3  → REQ listSessions     245ms  200      │  │ session  …         │     │
│  ...                                           │  │ turn     …         │     │
│                                                │  │ errorCode -32007 │ │     │
│                                                │  └────────────────────┘     │
│                                                │  [ Pretty | Raw ]  [Copy]   │
│                                                │  ┌────────────────────┐     │
│                                                │  │ {                  │     │
│                                                │  │   "method": …      │     │
│                                                │  │ }                  │     │
│                                                │  └────────────────────┘     │
│                                                │  ⓘ Copy includes raw         │
│                                                │     payload — may contain    │
│                                                │     tokens.                  │
├────────────────────────────────────────────────┴─────────────────────────────┤
│ Status bar (24px)  ● Connected · 12,431 events · 412 visible · selected #4823│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Region specs (Phase 3 deltas only)

| Region | Phase 2 → Phase 3 change |
|--------|---------------------------|
| Filter bar | **NEW** · height 40 px · background `--color-surface` · bottom 1px `--color-border` · always rendered when log is loaded |
| Active-chips row | **NEW** · height 32 px · background `--color-bg` · bottom 1px `--color-border` · conditionally rendered when ≥1 facet active OR query non-empty |
| Sticky group bar | **NEW** · height 24 px · background `--color-group-header-bg` · only rendered when `grouping !== "none"` AND list scrolled past the first group |
| Timeline region | unchanged geometry; flex-1 height now subtracts filter bar (and chip row + sticky group bar when present) |
| Detail rail | **CHANGED** — replaces `DetailRailPlaceholder` with `DetailPanel` · width is **resizable** between 360 and 600 px via a 4 px-wide drag handle on the left edge · default 420 px · width state is in-memory only (Phase 4 owns persistence) |
| Status bar | **CHANGED** copy — adds `· {visible}/{total} visible` segment when `visible !== total` |

### 5.2 Responsive behavior (Phase 3)

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Compact | <1024 px | Detail panel collapses to a full-screen overlay sheet (slides in from right, scrim over timeline); filter bar wraps to two rows; active-chips row scrolls horizontally |
| Standard | 1024–1599 px | Detail panel = 420 px default; resizable 360–600 px; filter bar single row with horizontal overflow scroll |
| Wide | 1600–1999 px | Detail panel = 480 px default; all facet chips visible without overflow |
| Ultra-wide | ≥ 2000 px | Detail panel = 560 px default; resize ceiling raised to 720 px |

Phase 3 ships full functionality at Standard and Wide. Compact overlay polish and Ultra-wide larger-detail-panel are validated visually but not gated.

### 5.3 Resize handle

- 4 px-wide hit area on the **left** edge of the detail panel.
- Cursor: `col-resize`.
- Visual: invisible by default; on hover, paints a 1 px line in `--color-accent` 60% alpha; on active drag, the line opacity goes to 100%.
- Keyboard: tab-focusable button with `aria-label="Resize detail panel"`, Left/Right arrow keys adjust width by 16 px increments.
- Min/max enforced before applying width: `Math.max(360, Math.min(600, width))` (Wide breakpoint raises ceiling to 720).

---

## 6. Filter Bar (SEARCH-01..04)

### 6.1 Layout

```
[ 🔍 Search method, id, payload…           ]  [Dir ▾] [Kind ▾] [Method ▾] [Action ▾]
                                                [Session ▾] [Turn ▾] [Status ▾] [Time ▾]
                                                [Group: None ▾]              12,431/12,431
```

- Padding: `0 var(--space-4)` left/right, `var(--space-2)` between elements.
- Search input takes flex priority (min 280 px, max 480 px). Facet chips wrap to a second visual row only at <1280 px (Compact handled separately).
- Group toggle is **right-aligned** with `margin-left: auto`. Result counter is the last element, also right-aligned, separated from the group toggle by `var(--space-3)`.

### 6.2 Search input

| Property | Value |
|----------|-------|
| Component | `<input type="search" />` styled with `text-row` (mono 13 px) |
| Width | `clamp(280px, 30vw, 480px)` |
| Height | 32 px |
| Background | `--color-surface-raised` |
| Border | 1 px `--color-border-strong`; on focus → 1 px `--color-accent` |
| Padding | `0 var(--space-2) 0 var(--space-5)` (24 px left for icon) |
| Icon | lucide `search` 14 px in `--color-text-muted`, absolutely positioned at left `var(--space-2)` |
| Placeholder | `Search method, id, payload…` |
| Clear button | lucide `x` 12 px in `--color-text-muted`, visible only when `query.length > 0`, `aria-label="Clear search"` |
| Debounce | 150 ms (network call). Local highlight pass uses React 19 `useDeferredValue`. |
| Length cap | 256 chars; the `<input>` enforces `maxLength={256}` to mirror the server cap. |
| Hotkey | `/` from anywhere in the app focuses this input (unless an input is already focused). Show a tiny `⌘K`-style keyboard hint glyph when the input is empty and unfocused: `/` rendered in a 16×16 pill at `--color-text-subtle`. |

### 6.3 Facet chips

Each facet is a `<button>` with the shape `[Label ▾]` or `[Label · N ▾]` when ≥1 value selected (N = number of selected values for that facet). Clicking opens an inline popover (custom, not Radix) anchored below the chip.

| Facet | Type | Source of options | Selection model |
|-------|------|-------------------|-----------------|
| Direction | enum | `c2s`, `s2c`, `unknown` | multi |
| Kind | enum | `REQ`, `RES`, `NTF`, `ACT`, `ERR`, `BAD` | multi |
| Method | dynamic | distinct `event.method` from rows | multi, virtualized list when >50 |
| Action | dynamic | distinct `event.actionType` | multi |
| Session | dynamic | distinct `event.session` (last-8 label, full id in tooltip) | multi |
| Turn | dynamic | distinct `event.turn` within selected sessions; disabled (grayed chip) when no Session is selected | multi |
| Status | enum | `ok` (2xx), `error` (non-2xx + RPC error + orphan), `pending`, `none` | multi |
| Time range | range | from/to via two `<input type="datetime-local">` inputs in the popover | range |

**Popover spec (per facet):**

- Background: `--color-surface`
- Border: 1 px `--color-border-strong`
- Box-shadow: `0 8px 24px rgb(0 0 0 / 0.4)`
- Min width: 220 px; max width: 360 px; max height: 320 px (scrolls)
- Padding: `var(--space-2)`
- Each option: 28 px row, `<label>` with checkbox + value text + small count badge in `--color-text-muted`
- Header (search popover only): a 24 px-tall mini search input that filters the option list (for Method facet on logs with hundreds of methods)
- Footer: 32 px row with `[Clear selection]` (resets only this facet) and `[Close]` (closes popover) — `[Close]` styled as a text button in `--color-accent`
- Closes on: click outside, Esc, or `[Close]`

**Chip states:**

| State | Visual |
|-------|--------|
| Idle (no values selected) | `--color-chip-bg`, `--color-chip-fg`, label only ("Direction"), chevron ▾ in `--color-text-muted` |
| Active (≥1 selected) | `--color-chip-bg-active`, label with count badge ("Direction · 2"), chevron ▾ |
| Open popover | same as Active, plus 1 px `--color-accent` outer ring |
| Disabled (e.g. Turn before Session chosen) | `--color-text-disabled` foreground, no hover, `aria-disabled="true"` |
| Hover | background lightens by `color-mix` 4% with `--color-text` |
| Focus-visible | inherit Phase 2 focus ring |

### 6.4 Active-filter chip row

Rendered only when at least one of the following is true: `query !== ""`, `filters.direction.size + filters.kind.size + ... > 0`. Heights, background, border per §5.1.

Each chip in this row represents **one selected value**, not a whole facet — e.g. four selected sessions = four chips. Search query renders as a single chip prefixed with `🔍` (lucide `search` 12 px).

| Element | Visual |
|---------|--------|
| Chip container | 24 px tall, `var(--space-1) var(--space-2)` padding, 12 px border-radius, `--color-chip-bg` |
| Chip label | sans 12 px, `Facet: value` (e.g. `Dir: c2s`, `Status: error`, `Session: a3f2…be`) |
| Chip dismiss | lucide `x` 12 px, hit area 16×16, `aria-label="Remove filter {label}"` |
| Search chip | `🔍 "<query>"` truncated at 40 chars with ellipsis; full query in `title` |
| Time-range chip | `Time: 14:32 → 14:45` (compact); `title` shows full ISO range |
| Clear all button | `text-ui-muted` text button, label `Clear all`, right-aligned, 24 px tall, `aria-label="Clear all filters and search"`. Visible always when chip row is rendered. |

### 6.5 Result counter

Format: `{visible}/{total} events`, where `visible` is the count after facets + search are applied (and group-header rows are *excluded* from the count).

- Render in `text-ui-muted`.
- When `visible === total`, render `{total} events` (no slash).
- When `visible === 0`, render `0/{total}` in `--color-warning` to draw attention.
- Tabular-nums: `font-variant-numeric: tabular-nums`.

### 6.6 Group toggle

A dedicated chip styled identically to the facet chips but always-rendered and with three options:

`Group: None ▾` / `Group: Session ▾` / `Group: Session + Turn ▾`

Popover lists the three options as radio buttons. Default = `None` (Phase 2 behavior preserved). Toggling resets scroll to top of the (newly grouped) list but **preserves selection** (selection is keyed by `idx`).

---

## 7. Detail Panel (DETAIL-01..04)

### 7.1 Structure

```
┌─ DetailPanel (aside, role="complementary") ──────────┐
│ Resize handle (4px, left edge)                       │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Auth-failure banner (only when isAuthFailure)    │ │  ← optional
│ │ 🔒 Authentication failure (-32007)               │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─ Summary ────────────────────────────────────────┐ │
│ │ 14:32:18.221 · Client → Server · REQ initialize │ │
│ │ Status: 200 · Latency: 12ms                      │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─ AHP Fields ─────────────────────────────────────┐ │  ← DETAIL-04 strip
│ │ │ session       a3f2c91e-…                       │ │
│ │ │ turn          7e0a…                            │ │
│ │ │ requestId     42                               │ │
│ │ │ errorCode     -32007 Authentication required   │ │
│ │ │ serverSeq     17  (gap: 12 → 17 expected 13)   │ │
│ │ │ origin        agent-host                       │ │
│ │ └──────────────────────────────────────────────────┘ │
│ ┌─ Tabs ────────────────────────────────────────────┐ │
│ │ [ Pretty ] [ Raw ]                       [Copy ▾] │ │
│ └───────────────────────────────────────────────────┘ │
│ ┌─ Truncation banner (only when truncated) ────────┐ │
│ │ ⚠ Payload truncated at 256 KB. [Open Raw]        │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─ JSON view ──────────────────────────────────────┐ │
│ │ (Pretty: react-json-view-lite tree)              │ │
│ │ (Raw: <pre> with monospace text)                 │ │
│ └──────────────────────────────────────────────────┘ │
│ ⓘ Copy includes raw payload — may contain tokens.    │  ← privacy caption
└──────────────────────────────────────────────────────┘
```

### 7.2 Empty state (no selection)

- Heading: `No event selected`
- Body: `Click a row or use ↑ ↓ to navigate. Press / to search.`
- Both centered vertically, `--space-8` padding, `text-heading` + `text-body`.
- No icon (Phase 2 used none for placeholder; consistent here).

### 7.3 Loading state (selection changed, fetch in flight)

- Same shell remains mounted (summary + AHP strip + tabs frame).
- JSON-view region replaced by a 32 px-tall `text-ui-muted` line: `Loading event #{idx}…`
- Spinner: lucide `loader-2` 14 px to the left of the text, `prefers-reduced-motion` honored.
- If fetch takes >500 ms, summary + strip render skeleton lines (12 px tall, `--color-surface-raised`); avoids flicker on fast LANs.

### 7.4 Error state (fetch failed)

- Body: `Failed to load event #{idx}.` in `--color-destructive`, then a smaller `text-ui-muted` line: `{error.message}` (with absolute paths already sanitized server-side per T-03-06).
- Action: `[Retry loading]` text button styled in `--color-accent`.

### 7.5 Summary section

A 2-line block under any banner:

- Line 1: `{ts} · {direction-word} · {kind} · {method-or-actionType}` in mono 13 px (`text-row`); method weight 600. Direction-word = "Client → Server" / "Server → Client" / "Internal".
- Line 2: `Status: {status} · Latency: {latency}` in mono 13 px `--color-text-muted`. When status is success, status renders in `--color-success`; on error, `--color-destructive`. When latency unknown, render `Latency: —`.

### 7.6 AHP Fields section (DETAIL-04)

A two-column key:value table, 24 px tall rows:

| Column | Width | Style |
|--------|-------|-------|
| Field stripe | 2 px | Color per §4.3 |
| Key | 96 px (fixed) | sans 12 px `--color-text-muted`, capitalized field name (e.g. `Session`) |
| Value | flex | mono 13 px `--color-text`; truncate at row width with tail ellipsis; full value in `title` |

Rows render only when the canonical event has the field. **errorCode** rows additionally render the AHP human-readable error label after the numeric code (e.g. `-32007 Authentication required`) when the code is in the AHP error registry; otherwise just the number.

For the **serverSeq** row, when `gapBefore: true`, append a small inline annotation in `--color-warning` 12 px sans: `(gap: {prev} → {curr} expected {prev+1})`.

### 7.7 Tabs and JSON views

Two tabs implemented with a `[role="tablist"]` containing two `<button role="tab">` elements:

| Tab | Content |
|-----|---------|
| Pretty (default) | `react-json-view-lite` tree, default expansion `level < 2`, key strings in `--color-info`, string values in `--color-success`, number/boolean in `--color-warning`, null in `--color-text-subtle`. Wrap in a `style` map sourced from tokens (no inline `#hex`). |
| Raw | `<pre>` with `JSON.stringify(raw, null, 2)`; `white-space: pre`; horizontal scroll; line numbers NOT shown in Phase 3 (deferred). React-escaped — no `dangerouslySetInnerHTML` anywhere (T-03-03). |

Tab strip:

- Height 32 px, border-bottom 1 px `--color-border`.
- Inactive tab: `--color-text-muted` foreground, 1 px transparent bottom border.
- Active tab: `--color-text` foreground, weight 600, 2 px `--color-accent` bottom border.
- Hover: foreground transitions to `--color-text` over 80 ms.
- Keyboard: Left/Right arrows when tablist focused; `Home`/`End` jump to first/last; Enter/Space activate.

When search query is non-empty and ≥ 2 chars, both views render `<mark>` highlights on substring matches in **string values** (Pretty) and across the rendered text (Raw). Match background uses `--color-search-match-bg`.

### 7.8 Truncation banner

When the server sets `truncated: true` (payload exceeded 4 MB) OR the pretty render exceeds the 256 KB client cap:

- Background: `color-mix(in srgb, var(--color-warning) 14%, var(--color-bg))`
- Foreground: `--color-warning`
- Glyph: lucide `alert-triangle` 14 px
- Body: `Payload truncated at {n} KB.` (server cap) or `Tree view truncated at 256 KB to keep the UI responsive.` (client cap)
- Action: `[Open Raw]` text button in `--color-accent` — switches to Raw tab; `[Copy full payload]` text button — copies the full server response (including the bytes the tree skipped).

### 7.9 Copy actions

A single dropdown button `[Copy ▾]` in the tab strip's right side, with three options:

- `Copy raw JSON` → full server response as `JSON.stringify(raw, null, 2)`
- `Copy pretty JSON` → same; difference is purely UI but the option is exposed for symmetry
- `Copy summary` → text block: `{ts} {direction-word} {kind} {method} status={status} latency={latency}` plus the AHP-fields strip rendered as `key: value` lines

Copy uses `navigator.clipboard.writeText` with a `<textarea>` selection fallback. After success: a 1.5-second toast at the bottom-right of the panel: `Copied {n} chars` in `--color-success` background tint. Toast auto-dismisses; one toast at a time; `prefers-reduced-motion` removes fade animation.

### 7.10 Privacy caption

A 12 px sans `--color-text-muted` line at the **bottom** of the panel, always rendered (even on empty state):

`ⓘ Copy includes raw payload — may contain tokens, prompts, or paths.`

Glyph: lucide `info` 12 px to the left, separated by `var(--space-1)`. The caption is not interactive.

### 7.11 Auth-failure banner (EVENT-06)

When the selected event's `isAuthFailure: true` OR the most recent unviewed event in the current session has it set:

- Renders **above** the Summary section.
- Height: 36 px.
- Background: `--color-auth-fail-banner-bg`.
- Foreground: `--color-destructive`.
- Glyph: lucide `shield-alert` 14 px.
- Body: `Authentication failure ({errorCode-or-notification-type})` in `text-ui` 13 px weight 600, followed by a smaller `text-ui-muted` line `Subsequent requests in this session may fail until re-auth.` (only when `errorCode === -32007`).
- Action: none in Phase 3 (Phase 4 may add "Jump to next auth event in this session").

---

## 8. Timeline list (Phase 3 deltas)

Phase 2's row contract (§7 of 02-UI-SPEC) is unchanged for normal event rows. Phase 3 adds two **non-event polymorphic items** to the virtual list and one per-row visual change.

### 8.1 Group-header virtual item

Rendered when `grouping !== "none"` at the boundary between two rows whose group key changed.

| Property | Value |
|----------|-------|
| Height | 24 px (`--row-group-header-height`) |
| Background | `--color-group-header-bg` |
| Top border | 1 px `--color-border` |
| Padding | `0 var(--space-3)` |
| Glyph | lucide `chevron-down` 12 px (collapsed: `chevron-right`) in `--color-text-muted` |
| Title | sans 13 px weight 600 in `--color-group-header-fg`. Format: `Session a3f2…be` (Session group) or `↳ Turn 7e0a…` (Turn group, indented 16 px). |
| Right side | sans 12 px `--color-group-header-meta`. Format: `412 events · 2.4s` (event count + first→last duration). Tabular-nums. |
| ARIA | `role="row" aria-level={level} aria-expanded` |

Click toggles collapse (Phase 3 supports collapse but state is in-memory; a collapsed group renders only its header). Keyboard: when focused, Left collapses, Right expands, Enter toggles.

### 8.2 Sticky group bar (chrome above the list)

Phase 3 ships the **chrome bar** approach (per 03-RESEARCH §6 Q5). When `grouping !== "none"`, a 24 px-tall bar is rendered immediately above the virtualized list, mirroring the topmost-visible group header. Content and styling identical to §8.1, plus a 1 px bottom border `--color-border-strong` to distinguish it as fixed chrome. The in-list header for the same group is still rendered (to keep virtual-item heights stable); the chrome bar simply duplicates it visually so users don't lose context on scroll.

### 8.3 Gap-banner virtual item (EVENT-06)

Rendered between rows whenever the current event has `gapBefore: true`.

| Property | Value |
|----------|-------|
| Height | 20 px (`--row-banner-height`) |
| Background | `--color-gap-banner-bg` |
| Foreground | `--color-gap-banner-fg` |
| Padding | `0 var(--space-3)` |
| Glyph | lucide `alert-triangle` 12 px |
| Body | mono 12 px: `serverSeq gap: {prev} → {curr} (missing {curr - prev - 1})` |
| Selectable | NO — pointer events on this row do not change selection. Tabbable: NO. |
| ARIA | `role="row" aria-label="Server sequence gap…"` |

### 8.4 Per-row changes for Phase 3

| Change | Trigger | Visual |
|--------|---------|--------|
| Auth-failure rail | `isAuthFailure: true` | Left rail solid `--color-auth-fail-rail` (`= --color-destructive`); a small lucide `shield-alert` 12 px overlays the direction column, replacing the direction glyph. The destructive rail color reuses `--color-destructive` so the row reads as "failed AND auth" — there is no separate "auth-only success" case in AHP. |
| Search-match highlight | query length ≥ 2 AND row matched | `<mark>` background `--color-search-match-bg` applied **only inside** Method column and Payload-preview column substrings. The full row is not tinted. |
| Filtered-out rows | not in result set | Not rendered at all — the virtual list operates on the filtered slice. |

---

## 9. Selection, Keyboard, and Focus (TIME-04)

### 9.1 Selection model

- Selection identifier is `EventRow.idx` — stable across appends, filters, group toggles, and search changes.
- Toggling grouping or filters preserves selection if the selected row remains in the visible set; otherwise selection is cleared.
- The detail panel always reflects `selectedIdx`; when selection clears, panel returns to empty state.
- Live-tail append while a row is selected does not move the selection, even if visible position changes.

### 9.2 Keyboard map (Phase 2 + Phase 3 additions)

| Key | Context | Action |
|-----|---------|--------|
| `Up` / `Down` | timeline focused | move selection ±1 over the **filtered + grouped** view, skipping group-headers and gap-banners |
| `PageUp` / `PageDown` | timeline focused | ±10 rows |
| `Home` / `End` | timeline focused | first / last visible event row |
| `Enter` | timeline focused, no selection | select first visible event row |
| `Tab` | global | walk focus order: search input → each facet chip → group toggle → result counter (skip) → resize handle → tab list → copy menu → JSON view container |
| `/` | anywhere except inside an input | focus search input; pre-selects all text |
| `Esc` | search input focused, query non-empty | clear query (1st press), then blur (2nd press) |
| `Esc` | popover open | close popover only |
| `Esc` | timeline focused, selection set | clear selection |
| `Esc` | timeline focused, no selection, ≥1 active filter | clear all filters (same as `Clear all` button) |
| `Esc` | timeline focused, no selection, no filters | no-op |
| `Left` / `Right` | tablist focused | switch Pretty/Raw |
| `Left` / `Right` | resize handle focused | adjust width by ±16 px |
| `g` then `s` (chord) | timeline focused | toggle group: None → Session → Session+Turn → None |
| `c` | detail panel focused | open Copy menu |
| `r` | detail panel focused | switch to Raw tab |
| `p` | detail panel focused | switch to Pretty tab |

The `g s` chord is a power-user nicety; it must not conflict with text inputs and only fires when no input has focus and the chord completes within 800 ms.

### 9.3 Focus ring

Inherited Phase 2 rule: 2 px `--color-accent` outline, 2 px offset, on `:focus-visible` only. Applies to: search input, facet chips, popover options, group toggle, resize handle, tab buttons, copy menu, retry button, banner action buttons, gap-banner is NOT focusable.

---

## 10. Empty / No-Results / Banner States (Phase 3)

| State | Trigger | Heading | Body | Action |
|-------|---------|---------|------|--------|
| Empty (Phase 2 inherited) | log has 0 events | `No events yet` | `This log file is empty. Events will appear as they are written.` | none |
| All-malformed (Phase 2 inherited) | every line failed to parse | `No valid events` | `All {N} lines in this file failed to parse. Showing parse errors below.` | none |
| **No matches (filters)** | `filters` reduce visible to 0, query empty | `No events match your filters` | `Try removing a filter or expanding the time range.` | `[Clear all filters]` text button in `--color-accent` |
| **No matches (search)** | query non-empty, 0 server matches, no facets active | `No events match your search` | `Try a shorter or different query. Search is case-insensitive substring across method, ids, session, turn, error text, and payload.` | `[Clear search]` text button |
| **No matches (combined)** | both query and filters active, 0 results | `No events match your search and filters` | `Try removing a filter or shortening your query.` | `[Clear all]` text button (same as chip-row Clear all) |
| **Search loading** | query non-empty, request in flight, no prior results | (timeline region preserves a 40 px-tall thin bar at the top of the list) `Searching {N} events…` in `--color-text-muted` mono 12 px with a 12 px lucide `loader-2` | — | — |
| **Search error** | `/api/log/search` returns non-200 | `Search failed` | `{error.message}` | `[Retry search]` text button |
| **Truncated results** | server returned 5000 capped matches | banner above list (32 px tall, `--color-warning` tint): `Showing first 5,000 of {total}+ matches. Refine your query for fewer results.` | — |
| **Auth-failure (any)** | any visible row has `isAuthFailure: true` | (no full-screen state; surfaced via row rail and detail-panel banner per §7.11 / §8.4) | — |

All "no matches" states are full-region replacements of the timeline list (chrome, filter bar, and detail panel remain). Centered layout, `--space-8` outer padding, same typography stack (heading `text-heading`, body `text-body`).

---

## 11. Copywriting Contract — Phase 3 strings

Every new string lands here verbatim. Use this table as the single source of truth for the planner and executor.

### 11.1 Filter bar / search

| Element | Copy |
|---------|------|
| Search placeholder | `Search method, id, payload…` |
| Search clear button aria | `Clear search` |
| Hotkey hint | `/` |
| Direction facet label | `Direction` |
| Direction facet values | `Client → Server`, `Server → Client`, `Unknown` |
| Kind facet label | `Kind` |
| Kind facet values | `Request`, `Response`, `Notification`, `Action`, `Error`, `Parse error` |
| Method facet label | `Method` |
| Method facet popover search placeholder | `Filter methods…` |
| Action facet label | `Action` |
| Session facet label | `Session` |
| Turn facet label | `Turn` |
| Turn facet disabled tooltip | `Pick a session first to filter by turn.` |
| Status facet label | `Status` |
| Status facet values | `OK`, `Error`, `Pending`, `None` |
| Time facet label | `Time` |
| Time facet "from" label | `From` |
| Time facet "to" label | `To` |
| Time facet apply button | `Apply range` |
| Facet popover Clear button | `Clear selection` |
| Facet popover close button | `Close` |
| Group toggle label | `Group` |
| Group toggle values | `None`, `Session`, `Session + Turn` |
| Active-chip facet prefixes | `Dir:`, `Kind:`, `Method:`, `Action:`, `Session:`, `Turn:`, `Status:`, `Time:` |
| Active-chip search prefix | `🔍` (lucide `search` glyph; not literal emoji) |
| Active-chip dismiss aria | `Remove filter {label}` |
| Clear-all button | `Clear all` |
| Clear-all aria | `Clear all filters and search` |
| Result counter (filtered) | `{visible}/{total} events` |
| Result counter (unfiltered) | `{total} events` |
| Search-truncated banner | `Showing first 5,000 of {total}+ matches. Refine your query for fewer results.` |

### 11.2 Detail panel

| Element | Copy |
|---------|------|
| Empty heading | `No event selected` |
| Empty body | `Click a row or use ↑ ↓ to navigate. Press / to search.` |
| Loading body | `Loading event #{idx}…` |
| Error heading | `Failed to load event #{idx}.` |
| Error retry | `Retry loading` |
| Summary line 2 (success) | `Status: {status} · Latency: {latency}` |
| Summary line 2 (no status) | `Status: — · Latency: —` |
| AHP-fields key labels | `Session`, `Turn`, `Tool call`, `Action type`, `Server seq`, `Origin`, `Request id`, `Error code`, `Notification type` |
| serverSeq gap inline | `(gap: {prev} → {curr} expected {prev+1})` |
| errorCode value format | `{code} {ahp-label}` (e.g. `-32007 Authentication required`); fallback `{code}` when label unknown |
| Pretty tab label | `Pretty` |
| Raw tab label | `Raw` |
| Copy menu button | `Copy` |
| Copy menu items | `Copy raw JSON`, `Copy pretty JSON`, `Copy summary` |
| Copy success toast | `Copied {n} chars` |
| Copy failure toast | `Copy failed. Select and copy manually.` |
| Pretty truncated banner | `Tree view truncated at 256 KB to keep the UI responsive.` |
| Server truncated banner | `Payload truncated at {n} KB.` |
| Truncation actions | `Open Raw`, `Copy full payload` |
| Privacy caption | `Copy includes raw payload — may contain tokens, prompts, or paths.` |
| Auth banner heading | `Authentication failure ({code-or-type})` |
| Auth banner body (-32007) | `Subsequent requests in this session may fail until re-auth.` |
| Auth banner body (notify/authRequired) | `Server is requesting authentication.` |
| Resize handle aria | `Resize detail panel` |

### 11.3 Timeline additions

| Element | Copy |
|---------|------|
| Group header — Session | `Session {sessionId-last8}` |
| Group header — Turn | `↳ Turn {turnId-last6}` |
| Group header — meta | `{count} events · {duration}` (duration formatted as `12ms`/`1.2s`/`2m 14s`) |
| Group header collapse aria | `Collapse {group label}` |
| Group header expand aria | `Expand {group label}` |
| Gap-banner body | `serverSeq gap: {prev} → {curr} (missing {n})` |
| Gap-banner aria | `Server sequence gap of {n} events between {prev} and {curr}` |

### 11.4 No-results states

| State | Heading | Body | Action label |
|-------|---------|------|--------------|
| Filters → 0 | `No events match your filters` | `Try removing a filter or expanding the time range.` | `Clear all filters` |
| Search → 0 | `No events match your search` | `Try a shorter or different query. Search is case-insensitive substring across method, ids, session, turn, error text, and payload.` | `Clear search` |
| Combined → 0 | `No events match your search and filters` | `Try removing a filter or shortening your query.` | `Clear all` |
| Searching | `Searching {N} events…` | — | — |
| Search error | `Search failed` | `{error.message}` | `Retry search` |

### 11.5 Status bar (Phase 3 update)

| State | Copy |
|-------|------|
| Connected, unfiltered | `● Connected · {N} events{ · selected #{idx}}?` |
| Connected, filtered | `● Connected · {visible}/{total} events{ · selected #{idx}}?` |
| Connected, grouped | adds `· {G} groups` segment between events and selection |

**Destructive actions in Phase 3:** none. No confirmation dialogs ship. `Clear all` is non-destructive (filter state is reset; events on disk are untouched).

**Primary CTA in Phase 3:** none in the running app. The closest in-app call to action is the `Clear all filters` text button on the no-results states (text-button styled, not filled accent).

---

## 12. Component Inventory (Phase 3 additions)

All components live in `packages/ui/src/components/`. Hand-built React 19, no external primitive library, no shadcn.

### 12.1 New components

| Component | File | Props sketch | Used by |
|-----------|------|--------------|---------|
| `FilterBar` | `filters/FilterBar.tsx` | (no props; reads from store) | AppShell |
| `SearchInput` | `filters/SearchInput.tsx` | `{ value, onChange, onClear }` | FilterBar |
| `FacetChip` | `filters/FacetChip.tsx` | `{ label, count, isOpen, isDisabled, onClick }` | FilterBar |
| `FacetPopover` | `filters/FacetPopover.tsx` | `{ anchor, options, selected, onChange, onClose, searchable? }` | each facet |
| `TimeRangePopover` | `filters/TimeRangePopover.tsx` | `{ from, to, onApply, onClose }` | FilterBar (Time facet) |
| `GroupToggleChip` | `filters/GroupToggleChip.tsx` | `{ value, onChange }` | FilterBar |
| `ActiveFilterChips` | `filters/ActiveFilterChips.tsx` | (reads store) | AppShell |
| `ActiveChip` | `filters/ActiveChip.tsx` | `{ label, onDismiss, ariaLabel }` | ActiveFilterChips |
| `ResultCounter` | `filters/ResultCounter.tsx` | `{ visible, total }` | FilterBar |
| `DetailPanel` | `detail/DetailPanel.tsx` | (reads `selectedIdx` + lazy event from store) | AppShell (replaces `DetailRailPlaceholder`) |
| `DetailResizeHandle` | `detail/DetailResizeHandle.tsx` | `{ width, onResize, min, max }` | DetailPanel |
| `DetailSummary` | `detail/DetailSummary.tsx` | `{ event }` | DetailPanel |
| `AhpFieldStrip` | `detail/AhpFieldStrip.tsx` | `{ event }` | DetailPanel |
| `AhpFieldRow` | `detail/AhpFieldRow.tsx` | `{ stripeColor, label, value, annotation? }` | AhpFieldStrip |
| `DetailTabs` | `detail/DetailTabs.tsx` | `{ active, onChange }` | DetailPanel |
| `PrettyJsonView` | `detail/PrettyJsonView.tsx` | `{ data, query?, capBytes }` | DetailPanel |
| `RawJsonView` | `detail/RawJsonView.tsx` | `{ data, query? }` | DetailPanel |
| `CopyMenu` | `detail/CopyMenu.tsx` | `{ event, onCopy }` | DetailPanel |
| `TruncationBanner` | `detail/TruncationBanner.tsx` | `{ kind: "client-cap" \| "server-cap", bytes, onOpenRaw, onCopyFull }` | DetailPanel |
| `AuthFailureBanner` | `detail/AuthFailureBanner.tsx` | `{ code?, notificationType? }` | DetailPanel |
| `PrivacyCaption` | `detail/PrivacyCaption.tsx` | (no props) | DetailPanel |
| `CopyToast` | `detail/CopyToast.tsx` | `{ message, kind: "success" \| "error" }` | DetailPanel |
| `GroupHeaderRow` | `timeline/GroupHeaderRow.tsx` | `{ level, sessionId?, turnId?, count, duration, isCollapsed, onToggle, virtualStyle }` | TimelineList |
| `StickyGroupBar` | `timeline/StickyGroupBar.tsx` | `{ topGroup }` | TimelineRegion |
| `GapBannerRow` | `timeline/GapBannerRow.tsx` | `{ prev, curr, virtualStyle }` | TimelineList |
| `NoResultsState` | `states/NoResultsState.tsx` | `{ kind: "filters" \| "search" \| "combined" \| "search-error", onClear, onRetry?, errorMessage? }` | TimelineRegion |
| `SearchingIndicator` | `states/SearchingIndicator.tsx` | `{ candidateCount }` | TimelineRegion |
| `SearchTruncatedBanner` | `states/SearchTruncatedBanner.tsx` | `{ shown, total }` | TimelineRegion |

### 12.2 Modified Phase 2 components

| Component | Change |
|-----------|--------|
| `AppShell` | Inserts `FilterBar` and (conditionally) `ActiveFilterChips` between `SourceStrip` and the timeline+detail flex row; renders `StickyGroupBar` above `TimelineRegion` when grouping; replaces `DetailRailPlaceholder` import with `DetailPanel`. |
| `TimelineRegion` | Adopts polymorphic virtual items (group headers, gap banners) via `estimateSize`/`getItemKey`; consumes `useFilteredRows()` selector instead of raw `rows`. |
| `TimelineList` | Renders one of `GroupHeaderRow` / `GapBannerRow` / `EventRow` / `ParseErrorRow` per virtual item by item-kind discriminant. |
| `EventRow` | Renders `<mark>` highlights when `searchQuery` is set; renders `shield-alert` glyph in direction column when `isAuthFailure`. |
| `StatusBar` | Adds `· {visible}/{total} visible` and `· {G} groups` segments. |
| `KeyboardShortcuts` (TimelineRegion's keydown handler today) | Extends per §9.2; adds `g s` chord buffer. |
| `useAppStore` | Adds slices: `searchQuery`, `searchMatches`, `filters`, `grouping`, `selectedDetail`, `detailWidth`, `groupCollapsed`. New actions per slice. |

All components consume tokens via CSS variables. **No raw `#hex` literals in component source.** Phase 2 grep guard remains in CI.

### 12.3 Components removed

| Component | Reason |
|-----------|--------|
| `DetailRailPlaceholder` | Replaced by `DetailPanel`; file deleted in Wave 2. |

---

## 13. Browser UAT Screenshot Expectations

Captured under `screenshots/phase3-*.png` using the project's playwright-cli skill. Each is committed to repo (per Phase 2 precedent).

| Filename | What it demonstrates |
|----------|----------------------|
| `phase3-detail-pretty.png` | Detail panel with Pretty tab on a successful response, AHP-fields strip with session+turn+requestId+serverSeq populated |
| `phase3-detail-raw.png` | Same selection, Raw tab, mono `<pre>` rendering |
| `phase3-detail-error.png` | Detail of a JSON-RPC error response: errorCode row in destructive, tag color visible |
| `phase3-detail-auth-banner.png` | Detail panel with auth-failure banner above summary, errorCode `-32007` |
| `phase3-detail-truncation.png` | Truncation banner active, `[Open Raw]` and `[Copy full payload]` visible |
| `phase3-detail-copy-toast.png` | Copy success toast 1.5 s after click |
| `phase3-filter-bar.png` | Filter bar with all 8 facet chips, search input empty, group toggle = None |
| `phase3-active-chips.png` | Active-chips row with: search query "initialize", Dir: c2s, Kind: REQ+RES, Status: error, Clear all visible |
| `phase3-no-results-filters.png` | "No events match your filters" empty state |
| `phase3-no-results-search.png` | "No events match your search" empty state |
| `phase3-search-truncated.png` | 5000-match cap banner above timeline |
| `phase3-grouped-session.png` | Group: Session active, two session group headers visible, sticky bar at top |
| `phase3-grouped-turn.png` | Group: Session + Turn active, nested turn headers (indented) |
| `phase3-gap-banner.png` | Inline serverSeq gap banner between two event rows |
| `phase3-auth-row.png` | Event row with destructive rail + shield-alert glyph in direction column |
| `phase3-search-highlight.png` | A row in the timeline with `<mark>` highlights on Method and Payload preview, plus the same `<mark>` highlights inside the detail panel |
| `phase3-resize-detail.png` | Detail panel resized near max width (600 px) on Standard breakpoint |
| `phase3-compact-overlay.png` | Compact (<1024 px) detail-panel overlay sheet over the timeline |

---

## 14. Design Tokens — Phase 3 manifest delta

To be **appended** to `packages/ui/src/styles/tokens.css` inside the existing `[data-theme="dark"]` block. Phase 5 must override these in `[data-theme="light"]` and `[data-theme="hacker"]`.

```css
:root,
[data-theme="dark"] {
  /* New row heights */
  --row-group-header-height: 24px;
  --row-banner-height: 20px;
  --filter-bar-height: 40px;
  --filter-chips-height: 32px;
  --detail-width-min: 360px;
  --detail-width-default: 420px;
  --detail-width-max: 600px;

  /* Search highlight */
  --color-search-match-bg: #3a3520;
  --color-search-match-fg: #e6e9ef;

  /* Filter chip */
  --color-chip-bg: #1c2129;
  --color-chip-bg-active: #262c36;
  --color-chip-border: var(--color-border-strong);
  --color-chip-fg: var(--color-text);
  --color-chip-fg-muted: var(--color-text-muted);
  --color-chip-dismiss: var(--color-text-muted);

  /* Group / gap / auth */
  --color-group-header-bg: #1a1f27;
  --color-group-header-fg: var(--color-text);
  --color-group-header-meta: var(--color-text-muted);
  --color-gap-banner-bg: color-mix(in srgb, var(--color-warning) 14%, var(--color-bg));
  --color-gap-banner-fg: var(--color-warning);
  --color-auth-fail-rail: var(--color-destructive);
  --color-auth-fail-banner-bg: color-mix(in srgb, var(--color-destructive) 14%, var(--color-bg));
}
```

**No new font sizes, weights, or spacing primitives.** The four sizes / two weights / 4 px-grid contract from Phase 2 is locked.

---

## 15. Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (shadcn not initialized) |
| third-party shadcn registries | none | not applicable |

**New runtime dependencies (non-registry, npm):**

| Package | Version | Why | Safety check |
|---------|---------|-----|--------------|
| `react-json-view-lite` | 2.5.0 | Folded pretty JSON tree (DETAIL-03) | Allow-list addition in `test/security.test.ts`; Wave 0 grep gate: `rg -n "eval\\(\|new Function\|Function\\(" node_modules/react-json-view-lite/` must return zero and record the result before any UI tree implementation merges. Plan 03-W0-03 enforces this deferred safety check. |

No CDN assets. No remote SVG. No new fonts. CSP `connect-src 'self'` preserved. Boundary test (`test/boundary.test.ts`) must continue to pass — `react-json-view-lite` is a React-only package with no Node imports.

---

## 16. Acceptance Criteria for the UI Checker

### Inherited from Phase 2 (must continue to hold)

- [ ] No raw `#hex` literals in `packages/ui/src/components/` (grep guard).
- [ ] Spacing values come from `--space-*` (or documented `--row-*-height` exceptions).
- [ ] Typography uses exactly six declared roles, four sizes (12/13/14/16), two weights (400/600).
- [ ] Color: 60/30/10 surface split visible; accent reserved for selected-row rail, focus ring, resize handle active-drag line, primary text-button labels (`Retry loading`, `Retry search`, `Clear all filters`, `Clear search`, `Clear all`, `Open Raw`, `Apply range`, `Close`).
- [ ] All semantic state colors paired with glyph or label.
- [ ] `prefers-reduced-motion` honored on every spinner and on copy-toast fade.
- [ ] No CDN, no Google Fonts, no remote SVG. CSP `connect-src 'self'`.

### New for Phase 3

- [ ] Filter bar always rendered when log is loaded; sticky at the top of the timeline+detail flex row.
- [ ] Active-chips row rendered iff `query !== "" || activeFacets > 0`.
- [ ] Each facet chip popover is keyboard-accessible (Tab/Esc/Enter/Space) and dismisses on click outside.
- [ ] Search input has `maxLength={256}`, debounced 150 ms, with abortable in-flight requests.
- [ ] `<mark>` highlights appear in Method, Payload preview, and inside Pretty/Raw JSON for query length ≥ 2.
- [ ] Detail panel renders Pretty by default and remembers user's last-chosen tab within the session.
- [ ] AHP-fields strip renders one row per present field, in the canonical order from §7.6, never with `—` placeholders.
- [ ] errorCode row renders the AHP human-readable label when in registry; otherwise just the code.
- [ ] Truncation banner appears whenever server `truncated: true` OR client cap exceeded; both `[Open Raw]` and `[Copy full payload]` actions present.
- [ ] Copy actions use `navigator.clipboard.writeText`; success toast renders `Copied {n} chars` for 1.5 s; failure toast renders the documented copy.
- [ ] Privacy caption is always rendered at the bottom of `DetailPanel`, including in empty / loading / error states.
- [ ] Resize handle: tab-focusable, Left/Right arrow adjusts ±16 px, width clamped 360–600 (720 on Ultra-wide).
- [ ] Group header virtual-item height = 24 px; gap-banner height = 20 px; both render at the documented backgrounds; gap banner is non-selectable and non-focusable.
- [ ] Sticky group bar is rendered above the timeline only when grouping is on; matches the topmost-visible in-list group header.
- [ ] EVENT-06 surfaces: row left rail goes destructive **and** lucide `shield-alert` replaces direction glyph when `isAuthFailure`; detail-panel auth banner renders above summary with correct copy per §11.2.
- [ ] No-results states use exact copy from §11.4. Action buttons reset the appropriate slice of state.
- [ ] Result counter format: `{visible}/{total} events` (filtered) or `{total} events` (unfiltered); tabular-nums.
- [ ] Status bar adds `· {visible}/{total} visible` segment when filtered; adds `· {G} groups` when grouped.
- [ ] Keyboard hierarchy of `Esc` matches §9.2 exactly; verified by jsdom test in Wave 4/5.
- [ ] No `dangerouslySetInnerHTML` anywhere in the new component tree (T-03-03).
- [ ] `react-json-view-lite` is the only new runtime dep; Wave 0 allow-list and `eval`-grep guard in place.

---

## 17. Dimensions / Mappings to Phase Requirements

| Requirement | Where satisfied in this contract |
|-------------|----------------------------------|
| TIME-04 | §9 Selection model (idx-stable) + §9.2 keyboard map |
| TIME-05 | §6.6 Group toggle + §8.1–8.2 Group headers + sticky bar |
| DETAIL-01 | §7 DetailPanel as side panel (not inline expansion); §5.1 detail rail width spec |
| DETAIL-02 | §7.5 Summary + §7.6 AHP-fields strip + §7.7 JSON tabs (full raw) |
| DETAIL-03 | §7.7 Pretty/Raw tabs + §7.8 Truncation + §7.9 Copy + §15 react-json-view-lite |
| DETAIL-04 | §7.6 AHP-fields strip + §4.3 stripe colors + §11.2 key labels |
| SEARCH-01 | §6.2 SearchInput contract + server haystack scan (03-RESEARCH); highlight in §7.7 + §8.4 |
| SEARCH-02 | §6.3 Facet chips (all eight facets specified) |
| SEARCH-03 | §6.2 debounce + abortable + `useDeferredValue`; non-blocking by spec |
| SEARCH-04 | §6.4 Active-filter chip row + Clear-all button |
| EVENT-06 | §7.11 Auth banner + §8.3 Gap-banner row + §8.4 Auth-failure rail + §4.4 tokens |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** draft 2026-05-07
