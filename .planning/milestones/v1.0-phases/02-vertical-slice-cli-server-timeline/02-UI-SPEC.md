---
phase: 2
slug: vertical-slice-cli-server-timeline
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-07
reviewed_at: 2026-05-07
---

# Phase 2 — UI Design Contract

> Visual and interaction contract for the first end-to-end vertical slice: CLI → local server → SSE → information-dense virtualized timeline. This phase establishes the **token foundation** (spacing, type, color, semantic event grammar) that Phases 3–5 will extend. Phase 5 owns full light/hacker themes; this phase ships **dark-first** with token names already abstracted so future themes are a CSS variable swap, not a rewrite.

---

## 0. Scope and Boundaries

**In scope (Phase 2):**

- App shell layout (header bar, source strip, timeline region, status bar).
- Virtualized timeline with fixed-height dense rows.
- Row visual grammar for direction, kind, status, latency, action taxonomy, and parse / unmatched / orphan / error states.
- Empty / loading / no-results / parse-error / disconnected screen-level states.
- A **placeholder** detail rail (right side) that previews selection but is NOT the Phase 3 inspector. Single-line summary + "Detail view ships in Phase 3" affordance.
- Design tokens (CSS custom properties) for spacing, type, color roles, event-kind colors, action taxonomy colors, latency severity bands, and semantic state colors.
- Dark theme only, exposed under `[data-theme="dark"]` so Phase 5 can add `light` / `hacker` without component changes.
- Keyboard basics: focus ring, Tab traversal, Up/Down to move selection, `Esc` to clear selection. (Full `j/k`, `/`, command palette = Phase 3.)
- CLI / browser open copy and the first-load handshake messages.

**Explicitly out of scope (deferred):**

- Full event detail inspector with pretty/raw JSON tabs, Shiki highlighting, copy actions → **Phase 3**.
- Free-text search, filter chips, faceted filters, time-range picker → **Phase 3**.
- Session/turn grouping, sticky group headers → **Phase 3**.
- Live tail UI: `following`/`paused` toggle, "jump to live" pill, new-event count → **Phase 4**.
- File auto-discovery picker, file-open dialog → **Phase 4**.
- Light theme, hacker theme, theme switcher, persisted theme preference → **Phase 5**.
- Settings panel, about dialog, command palette → **Phase 3+**.

**Non-goals for the no-results state in Phase 2:** since search/filter does not exist yet, the only path that reaches "no results" is an *empty file* or an *all-malformed file*. We design a no-results state token + copy now so Phase 3 can reuse it; we do not build filter chips to trigger it.

---

## 1. Design System

| Property | Value |
|----------|-------|
| Tool | none (custom Tailwind v4 + CSS variables, no shadcn) |
| Preset | not applicable |
| Component library | none — hand-built primitives in `packages/ui/src/components/` |
| Icon library | `lucide-react` (tree-shaken, self-bundled, no CDN) |
| UI font | Inter Variable, self-hosted at `packages/ui/public/fonts/inter/` |
| Mono font | JetBrains Mono Variable, self-hosted at `packages/ui/public/fonts/jetbrains-mono/` |
| System fallback | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for UI; `ui-monospace, "SF Mono", Menlo, Consolas, monospace` for mono |
| CSS approach | Tailwind v4 with `@theme` block exposing CSS custom properties; component styles use `@apply` only inside `@layer components` |
| Theme attribute | `<html data-theme="dark">` — Phase 2 ships `dark` only; Phase 5 adds `light`, `hacker` |
| Asset policy | All fonts, icons, and styles bundled by Vite; CSP `connect-src 'self'`; **no CDN, no Google Fonts, no remote SVG** |

**Why no shadcn:** the product is a single-document devtool with one bespoke heavy widget (the timeline). shadcn's Radix-based generalist components (Dialog, DropdownMenu, Select) are not on the Phase 2 critical path, and the timeline row, status pills, and density requirements are too custom to benefit from shadcn primitives. Phase 3 may reintroduce specific Radix primitives (Popover for filter chips, Tabs for detail) à la carte without taking the whole shadcn preset.

---

## 2. Spacing Scale

Strict 4px grid. Declared values (multiples of 4 only):

| Token | CSS variable | Value | Usage |
|-------|--------------|-------|-------|
| `space-0` | `--space-0` | 0px | Reset |
| `space-1` | `--space-1` | 4px | Icon-to-text gap, tag inner padding, row-cell horizontal padding |
| `space-2` | `--space-2` | 8px | Compact element spacing; gap between row columns; pill inner padding-x |
| `space-3` | `--space-3` | 12px | Header bar inner padding-y; status bar inner padding |
| `space-4` | `--space-4` | 16px | Default element gap; source strip padding; section gutters |
| `space-5` | `--space-5` | 24px | Empty/error state vertical rhythm |
| `space-6` | `--space-6` | 32px | Empty/error state outer padding |
| `space-8` | `--space-8` | 48px | Empty/error state hero spacing |

**Exceptions and documented off-8-grid values:**

- **`--space-3: 12px`** — on the 4px grid but not on the 8px sub-scale. Justified for chrome inner padding-y where 8px clips visually against 13px text and 16px is too airy for a 40px header / 24px status bar. Used only in: header-bar inner padding-y, status-bar inner padding. Not used as a generic gap.
- **Row height = 28px (fixed)** — not on the 4px scale by happy accident: this is `space-3 + 16px` chosen to fit one line of 13px mono text + 4+4 padding. Locked via `--row-height: 28px`. Rationale: maximum density without clipping descenders in JetBrains Mono at 13px.
- **Touch / hit targets:** for keyboard-only interactions in Phase 2 we accept the 28px row as the hit target. Future filter pill buttons in Phase 3 must hit ≥32px height.
- **Focus ring offset** is `2px` (visual only, not a layout value).

---

## 3. Typography

Four sizes, two weights. Mono is reserved for **timestamps, IDs, methods, payload preview** — everything where character alignment helps scanning. Sans is reserved for chrome (header labels, status bar, empty-state copy).

| Role | CSS variable | Family | Size | Weight | Line height | Usage |
|------|--------------|--------|------|--------|-------------|-------|
| `text-row` | `--text-row` | mono | 13px | 400 | 20px (≈1.54) | Timeline row content (timestamp, method, IDs, preview) |
| `text-row-strong` | `--text-row-strong` | mono | 13px | 600 | 20px | Method name, status code when emphasized |
| `text-ui` | `--text-ui` | sans | 13px | 400 | 20px (1.54) | Header bar labels, status bar text, button labels |
| `text-ui-muted` | `--text-ui-muted` | sans | 12px | 400 | 16px (1.33) | Secondary status, source strip metadata, captions, kind-tag pill (§5.2) |
| `text-heading` | `--text-heading` | sans | 16px | 600 | 24px (1.5) | Empty/error state heading |
| `text-body` | `--text-body` | sans | 14px | 400 | 21px (1.5) | Empty/error state body, placeholder detail rail copy |

**Locked rules:**

- Exactly **two weights** in active use: 400 (regular) and 600 (semibold). No 500 / medium tier — it has been removed from the token manifest.
- Exactly **four sizes** in active use: 12px, 13px, 14px, 16px.
- **No italics anywhere** in Phase 2.
- **No text-decoration: underline** except on `:focus-visible` of inline links (Phase 2 has none).
- Numeric tabular alignment: timestamps and latency render with `font-variant-numeric: tabular-nums`.

---

## 4. Color

**Palette philosophy:** dark-first, IDE-inspired neutral surface (closer to VS Code "Dark Modern" than pure black). Accent is reserved exclusively for **selection** and the **primary CTA**. All other meaning is carried by the **semantic event grammar** (§6, §7) — these are *categorical* colors, not accents, and live in their own token namespace.

### 4.1 Surface and chrome (60 / 30 / 10)

| Role | Token | Value | % |
|------|-------|-------|---|
| Dominant surface (60%) | `--color-bg` | `#0E1116` | Timeline canvas, app background |
| Secondary surface (30%) | `--color-surface` | `#161A21` | Header bar, source strip, status bar, placeholder detail rail |
| Surface raised | `--color-surface-raised` | `#1C2129` | Selected row background, hover row background (alpha-blended) |
| Border subtle | `--color-border` | `#262C36` | Row separator (when used), section dividers |
| Border strong | `--color-border-strong` | `#39414E` | Header/footer divider, focus container outline |
| Accent (10%) | `--color-accent` | `#7AA2F7` | **Reserved for:** selected row left rail, primary CTA in empty states, focus ring |
| Accent on-color | `--color-accent-foreground` | `#0E1116` | Text on accent buttons |

Accent reserved for: **selected-row 2px left indicator bar**, **primary CTA button background in empty/error states ("Open a JSONL file" CLI hint button is a *non-action* tooltip; there is no real primary CTA in Phase 2 because file open is CLI-only — accent therefore appears almost exclusively on the selected row)**, and the **focus-visible ring**. Never on hover, never on event status, never as a generic "interactive" color.

### 4.2 Text on surface

| Role | Token | Value | Contrast on `--color-bg` |
|------|-------|-------|--------------------------|
| Primary text | `--color-text` | `#E6E9EF` | 13.4:1 (AAA) |
| Secondary text | `--color-text-muted` | `#A4ADBE` | 7.1:1 (AAA) |
| Tertiary text | `--color-text-subtle` | `#6B7385` | 4.7:1 (AA Large; used only for non-essential metadata such as orphan-event timestamps) |
| Disabled / placeholder | `--color-text-disabled` | `#4B5263` | 3.0:1 (decorative only — never sole carrier of meaning) |

### 4.3 Semantic state colors (destructive + warning + success + info)

These carry meaning and **must always be paired with a glyph or text label** (never color-only).

| Role | Token | Value | Pair-with |
|------|-------|-------|-----------|
| Success | `--color-success` | `#7DCFA4` | ✓ glyph or 2xx status text |
| Warning | `--color-warning` | `#E0AF68` | ⚠ glyph (orphan, slow, unmatched) |
| Destructive / error | `--color-destructive` | `#F7768E` | ✕ glyph or error text/code |
| Info | `--color-info` | `#7DCFFF` | ⓘ glyph (parse-error annotations only) |

**Destructive rule:** Phase 2 has zero destructive *actions* (no deletion, no overwrite). `--color-destructive` is only used to render *received* error events (4xx/5xx, JSON-RPC error responses, malformed lines). No confirmation dialogs.

---

## 5. Visual Grammar — Direction, Kind, Action Taxonomy, Latency, Status

The categorical color system that makes the timeline scannable. These tokens live in a separate namespace from the chrome palette so theme switching in Phase 5 can recolor chrome without touching the event grammar.

### 5.1 Direction (column 2 of every row)

| Direction | Glyph | Token | Value | Tooltip |
|-----------|-------|-------|-------|---------|
| Client → Server | `→` | `--dir-c2s` | `#7AA2F7` (cool blue) | "Client → Server" |
| Server → Client | `←` | `--dir-s2c` | `#BB9AF7` (cool violet) | "Server → Client" |
| Internal / state | `•` | `--dir-internal` | `#A4ADBE` (neutral) | "Internal" |
| Unknown | `?` | `--color-text-subtle` | — | "Unknown direction" |

Direction is encoded by **glyph + color**, never color alone. Glyph rendered in mono at 13px.

### 5.2 Event kind (column 3 — small uppercase tag)

Kind tag is a 2–4 character UPPERCASE label in a 1px-bordered pill, sans `text-ui-muted` (12px / weight 400), padding `2px 6px`. Color is the **border + text**, fill is `transparent` so kind tags do not over-saturate dense rows.

| Kind | Tag | Token | Value |
|------|-----|-------|-------|
| Request | `REQ` | `--kind-request` | `#7AA2F7` |
| Response | `RES` | `--kind-response` | `#7DCFA4` |
| Notification | `NTF` | `--kind-notification` | `#E0AF68` |
| Action | `ACT` | `--kind-action` | `#BB9AF7` |
| Error | `ERR` | `--kind-error` | `#F7768E` |
| Parse error | `BAD` | `--kind-parse-error` | `#F7768E` (with hatched left rail, see §6) |

### 5.3 Action taxonomy (column 4 — micro-dot + tooltip)

When `kind === "action"`, render an additional 6px filled circle before the action type string. Phase 2 ships these five families; unknown action types fall back to neutral.

| Family | Token | Value | Examples |
|--------|-------|-------|----------|
| `text` | `--action-text` | `#7DCFA4` | streaming text, completion |
| `tool-call` | `--action-tool-call` | `#7AA2F7` | tool invocation |
| `tool-result` | `--action-tool-result` | `#9ECE6A` | tool result/output |
| `status` | `--action-status` | `#A4ADBE` | turn lifecycle, state |
| `unknown` | `--action-unknown` | `#6B7385` | fallback |

The dot color is **decorative reinforcement**; the action type string itself is the source of truth and is always rendered as text. Tooltip on the dot reads `Action family: {family}`.

### 5.4 Latency severity (column 9 — text + background bar)

Latency renders as right-aligned tabular-num text with a 2px-tall background bar (full-width-of-cell) whose color reflects the severity band.

| Band | Range (ms) | Token | Value |
|------|------------|-------|-------|
| Fast | 0–50 | `--latency-fast` | `#3A4A3F` (muted green, low chroma) |
| Normal | 51–250 | `--latency-normal` | `#3A4252` (neutral; intentionally near surface) |
| Slow | 251–1000 | `--latency-slow` | `#5A4A2E` (muted amber) |
| Critical | >1000 | `--latency-critical` | `#5A2E36` (muted red) |
| Unknown | not yet correlated | — | bar omitted; cell shows `—` in `--color-text-subtle` |

Bars are intentionally low-chroma so they do not compete visually with the kind tag and direction column. The numeric text uses `--color-text` (full contrast), not the bar color.

### 5.5 Status (column 8 — text)

| Status | Render | Token |
|--------|--------|-------|
| 2xx / OK | `200`, `OK` in `--color-success` | `--color-success` |
| 4xx | `4xx code` in `--color-destructive` | `--color-destructive` |
| 5xx | `5xx code` in `--color-destructive` weight 600 | `--color-destructive` |
| JSON-RPC error | `RPC -32601` etc. in `--color-destructive` | `--color-destructive` |
| Pending (request without response yet) | `…` in `--color-text-muted` | — |
| Notification / action (no status concept) | `—` in `--color-text-subtle` | — |
| Orphan response (no matching request) | `ORPHAN` pill (warning) | `--color-warning` |

---

## 6. Layout — App Shell

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Header bar (40px)        AHP Inspector · v0.1                          │
├─────────────────────────────────────────────────────────────────────────┤
│ Source strip (32px)      📄 sample.jsonl · 12,431 events · 3 sessions   │
├──────────────────────────────────────────────────┬──────────────────────┤
│                                                  │                      │
│  Timeline region                                 │  Detail rail         │
│  (virtualized, fills remaining height)           │  (placeholder        │
│                                                  │   in Phase 2)        │
│  ────────────────────────────────────────        │                      │
│  Row 1  → REQ initialize        12ms  200        │  Select a row to     │
│  Row 2  ← RES initialize        —     OK         │  preview.            │
│  Row 3  → REQ listSessions     245ms  200        │                      │
│  Row 4  ! BAD (malformed line)                   │  Detail view ships   │
│  ...                                             │  in Phase 3.         │
│                                                  │                      │
├──────────────────────────────────────────────────┴──────────────────────┤
│ Status bar (24px)        ● Connected · 12,431 events · selected #4823   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Region specs

| Region | Height | Background | Border | Notes |
|--------|--------|------------|--------|-------|
| Header bar | 40px fixed | `--color-surface` | bottom 1px `--color-border-strong` | App name left, version right, both `text-ui` |
| Source strip | 32px fixed | `--color-surface` | bottom 1px `--color-border` | File icon (lucide `file-json`), file name (mono `text-row`), event count + session count (`text-ui-muted`); single line, truncates middle of file path with ellipsis |
| Timeline region | flex 1 | `--color-bg` | none | Virtualized list; horizontal scroll disabled — content fits via responsive column behavior |
| Detail rail | 320px fixed (Phase 2) | `--color-surface` | left 1px `--color-border-strong` | Phase 2 placeholder; Phase 3 expands to resizable 360–600px |
| Status bar | 24px fixed | `--color-surface` | top 1px `--color-border` | Connection dot + label, event count, selected row id; single line, `text-ui-muted` |

### 6.2 Responsive behavior (Phase 2 baseline)

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Compact | <1024px | Detail rail collapses (hidden); header source strip wraps to 2 lines; row drops `Session` and `Turn` columns (still in tooltip) |
| Standard | 1024–1599px | Detail rail = 320px; all columns visible |
| Wide | 1600–1999px | Detail rail = 320px; Payload preview column gets +200px |
| Ultra-wide | ≥2000px | Detail rail = 360px; Payload preview column flexes to fill remainder |

Phase 2 ships full functionality at Standard. Compact and Ultra-wide are validated visually but no horizontal scroll fallback is added until Phase 5.

---

## 7. Timeline Row Contract

### 7.1 Row geometry

- **Height:** 28px fixed. No dynamic-height in Phase 2; payload preview is single-line, ellipsized.
- **Padding:** `4px 8px` (top/bottom by `space-1`, left/right by `space-2`).
- **Bottom border:** none. Row separation comes from alternating background tint at 4% opacity:
  - Even rows: `--color-bg`
  - Odd rows: `color-mix(in srgb, var(--color-bg) 96%, var(--color-text) 4%)`
- **Left rail:** 2px-wide vertical bar, full row height, used to encode event-level severity:
  - Default: transparent
  - Selected: `--color-accent`
  - Parse-error row: `--color-destructive` with diagonal-hatch CSS background (`repeating-linear-gradient(45deg, var(--color-destructive) 0 2px, transparent 2px 6px)`)
  - Orphan response: `--color-warning` solid
  - Failed/error response: `--color-destructive` solid

### 7.2 Columns (left → right)

| # | Column | Width | Font | Content | Truncation |
|---|--------|-------|------|---------|------------|
| 1 | Left rail | 2px | — | severity bar (§7.1) | — |
| 2 | Timestamp | 96px | mono `text-row` | `HH:mm:ss.SSS` (UTC, local-tz offset in tooltip) | none (fixed format) |
| 3 | Direction | 16px | mono `text-row` | glyph (§5.1) | none |
| 4 | Kind tag | 44px | sans `text-ui-muted` (12px) in pill | `REQ`/`RES`/`NTF`/`ACT`/`ERR`/`BAD` (§5.2) | none |
| 5 | Method / action type | 220px | mono `text-row` (semibold for method) | e.g. `initialize`, `dispatchAction`, `text` (with action dot for ACT) | tail ellipsis; full value in tooltip |
| 6 | Session | 64px | mono `text-row` | last 8 chars of session id | tail ellipsis; full id in tooltip |
| 7 | Turn | 48px | mono `text-row` | last 6 chars of turn id, or `—` | tail ellipsis; full id in tooltip |
| 8 | Status | 64px | mono `text-row` | (§5.5) | none |
| 9 | Latency | 72px | mono `text-row` tabular-nums + bar (§5.4) | `12ms`, `1.2s`, or `—` | none |
| 10 | Key IDs | 96px | mono `text-row-subtle` | request id (truncated), or `—` | tail ellipsis |
| 11 | Payload preview | flex | mono `text-row` `--color-text-muted` | first ~120 chars of `JSON.stringify(raw.params \|\| raw.result \|\| raw)`; whitespace collapsed | tail ellipsis |

Tooltips appear on hover after 600ms via `title` attribute (Phase 2 uses native `title` only — no custom tooltip primitive until Phase 3).

### 7.3 Row states

| State | Trigger | Visual |
|-------|---------|--------|
| Default | — | base palette per §7.1 |
| Hover | mouse over row | background = `--color-surface-raised`; cursor `pointer` |
| Selected | clicked or focused via keyboard | background = `--color-surface-raised`; left rail = `--color-accent`; persists across re-render and scroll |
| Focused (keyboard) | `:focus-visible` from Tab/Up/Down | 2px `--color-accent` outline inset, 0px offset; combined with selected if both apply |
| Parse-error | row's `kind === "parse-error"` | left rail hatched-destructive; columns 4–11 collapse into a single `text-row` cell rendering `BAD · line {n} · {parser_message}` in `--color-destructive` |
| Orphan response | response without matched request | left rail solid warning; column 8 shows `ORPHAN` warning pill |
| Failed (received error) | response with non-2xx or RPC error | left rail solid destructive; column 8 shows status in destructive |
| Pending (request, no response yet) | request awaiting correlation | column 8 shows `…`; column 9 shows `—`; row otherwise default |

**Selection model (Phase 2):** single-select, click or keyboard. `Esc` clears selection. Selected row id is stored in app state and reflected in the status bar. Detail rail renders the selected row's normalized summary line (timestamp · direction · kind · method · status) plus the placeholder copy from §10.

---

## 8. Screen-Level States

Each is a single full-region replacement of the timeline area (the chrome — header, source strip, status bar — remains in their loading variants). All use the empty-state typography stack (§3) and centered layout with `--space-8` outer padding.

### 8.1 Loading (initial snapshot fetch)

- **Trigger:** browser opened by CLI, before SSE delivers first chunk.
- **Visual:** centered column with a 16px lucide `loader-2` icon spinning at `--color-text-muted` (`prefers-reduced-motion` → static icon, no spin), heading, body.
- **Heading:** `Loading log…`
- **Body:** `Reading {filename}` with `{filename}` rendered in mono.
- **Status bar:** connection dot in `--color-warning`, label `Connecting…`.

### 8.2 Empty (file is a valid 0-byte / 0-event log)

- **Heading:** `No events yet`
- **Body:** `This log file is empty. Events will appear as they are written.`
- **Note:** no CTA — Phase 2 has no in-app file open. CLI-only.
- **Status bar:** `● Connected · 0 events`.

### 8.3 No-results (token reserved for Phase 3; renders only if file is all-malformed in Phase 2)

- **Trigger Phase 2:** every line in the file failed to parse (no canonical events produced, only parse-errors). Rather than showing only red rows in a sea of nothing, we surface a banner above the timeline.
- **Heading:** `No valid events`
- **Body:** `All {N} lines in this file failed to parse. Showing parse errors below.`
- **Behavior:** banner sits between source strip and timeline (height 64px, background `--color-surface`, left border 4px `--color-warning`). Timeline still renders the parse-error rows.
- **Phase 3 reuse:** same component, swapped copy: `No events match the current filters.`

### 8.4 Parse-error (per-line, inline — not a screen-level state)

Per §7.3 — parse errors render as individual `BAD` rows interleaved with valid events in source order. There is no screen-level parse-error state; the system is **tolerant by design**.

### 8.5 Disconnected (SSE stream dropped)

- **Trigger:** SSE connection closes unexpectedly (server killed, file moved, network blip on localhost).
- **Visual:** **non-blocking** toast-banner at the top of the timeline region (does NOT replace it — the user keeps their selection and scroll position). 40px tall, full-width, `--color-surface` background, `--color-destructive` 2px left border, lucide `wifi-off` icon, and copy.
- **Copy:** `Disconnected from log stream. Showing last received events.`
- **Action:** inline text button `Retry connection` on the right (Phase 2: triggers a manual reconnect; if reconnect fails, banner stays and dot stays red).
- **Status bar:** connection dot in `--color-destructive`, label `Disconnected`.

### 8.6 Server-not-running (browser opened directly without CLI)

- **Trigger:** UI bundle loaded but `/api/log` returns 503 or never reached because no server.
- **Heading:** `Start the viewer from the CLI`
- **Body:** `Run \`ahp-inspector path/to/log.jsonl\` from your terminal, then refresh this page.` (the command rendered in mono on its own line)
- **Status bar:** connection dot in `--color-destructive`, label `No server`.

---

## 9. Interaction & Accessibility

### 9.1 Keyboard

| Key | Action |
|-----|--------|
| `Tab` | Move focus through chrome → timeline → detail rail |
| `Shift+Tab` | Reverse |
| `↑` / `↓` | When timeline focused: move selection up/down by one row; auto-scroll selected row into view (`block: 'nearest'`) |
| `PageUp` / `PageDown` | Move selection by one viewport |
| `Home` / `End` | Move selection to first / last row |
| `Enter` | (Phase 2 no-op, reserved for Phase 3 detail open) |
| `Esc` | Clear selection |

Keyboard navigation reuses the existing selection model — there is no separate "focused row but not selected" state in Phase 2. Focus = selection in the timeline.

### 9.2 Focus indicators

- All focusable elements get `:focus-visible` outline of `2px solid var(--color-accent)` at `2px` offset.
- Inside the timeline, focus uses the `inset` outline variant from §7.3 to avoid clipping at row edges.
- `:focus` (without `-visible`) is suppressed to avoid mouse-click outlines.

### 9.3 Reduced motion

- `@media (prefers-reduced-motion: reduce)` disables the loading spinner animation and any future row-enter transitions. Selection change and scroll are instant by default in Phase 2.

### 9.4 Contrast

- All text/background pairs meet WCAG 2.2 AA at minimum (4.5:1 for body, 3:1 for large/UI). Most pairs meet AAA — see §4.2 measured values.
- Semantic state colors (success/warning/destructive) are validated against `--color-bg` AND `--color-surface` AND `--color-surface-raised` (selected row).
- Color is **never** the sole carrier of meaning: direction = glyph + color, kind = label + color, status = text + color, parse-error = hatched rail + tag + label.

### 9.5 Virtualization accessibility

- Timeline is a `<div role="grid" aria-rowcount={total} aria-label="AHP event timeline">`.
- Each rendered row is `<div role="row" aria-rowindex={1-based} aria-selected={bool}>`; cells are `<div role="gridcell">`.
- Off-screen rows are not in the DOM (TanStack Virtual). `aria-rowcount` reflects total, so screen readers announce position correctly.
- A visually-hidden live region (`aria-live="polite"`) announces SSE state changes: `Connected. 12,431 events loaded.` / `Disconnected.`
- Selected row updates announce as `Row {n} selected: {direction} {method} {status}`.

---

## 10. Copywriting Contract

Voice: **terse, factual, devtools-tone**. No exclamation marks. No emoji. No "Oops!" — the user is debugging protocol traffic; assume technical literacy. Mono font for filenames, commands, IDs; sans for everything else.

| Element | Copy |
|---------|------|
| App title (header) | `AHP Inspector` |
| Version label | `v{semver}` (e.g. `v0.1.0`) |
| Source strip — file present | `{file_basename} · {N} events · {M} sessions` (with N/M tabular-num) |
| Source strip — 0 events | `{file_basename} · 0 events` |
| CLI — invocation success (printed to terminal) | `AHP Inspector running at http://127.0.0.1:{port}\nOpening browser…\nWatching {abs_path}` |
| CLI — file not found | `Error: log file not found: {path}\nUsage: ahp-inspector <path-to-log.jsonl>` (exit 1) |
| CLI — file not readable | `Error: cannot read {path}: {os_error}\nCheck file permissions.` (exit 1) |
| CLI — port in use | `Error: port {port} is in use. Try: ahp-inspector --port {port+1} {path}` (exit 1) |
| Browser — loading heading | `Loading log…` |
| Browser — loading body | `Reading {filename}` |
| Browser — empty heading | `No events yet` |
| Browser — empty body | `This log file is empty. Events will appear as they are written.` |
| Browser — no-results heading (all-malformed) | `No valid events` |
| Browser — no-results body | `All {N} lines in this file failed to parse. Showing parse errors below.` |
| Browser — disconnected banner | `Disconnected from log stream. Showing last received events.` |
| Browser — disconnected action | `Retry connection` |
| Browser — server-not-running heading | `Start the viewer from the CLI` |
| Browser — server-not-running body | `Run \`ahp-inspector path/to/log.jsonl\` from your terminal, then refresh this page.` |
| Detail rail placeholder — no selection | `Select a row to preview.` |
| Detail rail placeholder — has selection | `{timestamp} · {direction-word} · {KIND} · {method}\nFull detail view ships in Phase 3.` |
| Status bar — connected | `● Connected · {N} events{ · selected #{rowIndex}}?` |
| Status bar — connecting | `◐ Connecting…` |
| Status bar — disconnected | `● Disconnected` |
| Parse-error row text | `BAD · line {n} · {parser_message}` |
| Orphan response pill | `ORPHAN` |
| Pending status cell | `…` |
| No-value cell | `—` (em dash) |
| Direction tooltip — c2s | `Client → Server` |
| Direction tooltip — s2c | `Server → Client` |
| Direction tooltip — internal | `Internal` |
| Kind tooltip | `{Request\|Response\|Notification\|Action\|Error\|Parse error}` |
| Action family tooltip | `Action family: {family}` |
| Latency tooltip | `Latency: {value}ms (band: {fast\|normal\|slow\|critical})` |
| Session/Turn tooltip | full id, mono |
| Method tooltip | full method name (when truncated) |

**Destructive actions in Phase 2:** none. No confirmation dialogs ship.

**Primary CTA in Phase 2:** none in the running app. The CLI invocation copy *is* the primary CTA path. The closest thing to an in-app CTA is the `Retry connection` text button in the disconnected banner, styled as a text button (not filled accent) because it is recovery, not progression.

---

## 11. Component Inventory (Phase 2)

Components live in `packages/ui/src/components/`. Each is a hand-built React 19 functional component, no external primitive library.

| Component | File | Props sketch | Used by |
|-----------|------|--------------|---------|
| `AppShell` | `shell/AppShell.tsx` | `{ children }` | App root |
| `HeaderBar` | `shell/HeaderBar.tsx` | `{ version }` | AppShell |
| `SourceStrip` | `shell/SourceStrip.tsx` | `{ filename, eventCount, sessionCount }` | AppShell |
| `StatusBar` | `shell/StatusBar.tsx` | `{ connection, eventCount, selectedRowIndex? }` | AppShell |
| `TimelineRegion` | `timeline/TimelineRegion.tsx` | `{ events, selection, onSelect }` | AppShell |
| `TimelineList` | `timeline/TimelineList.tsx` | `{ rows, rowHeight: 28, onRowClick, selectedId }` (TanStack Virtual) | TimelineRegion |
| `EventRow` | `timeline/EventRow.tsx` | `{ event, isSelected, isFocused, virtualStyle }` | TimelineList (`memo`) |
| `DirectionGlyph` | `timeline/cells/DirectionGlyph.tsx` | `{ direction }` | EventRow |
| `KindTag` | `timeline/cells/KindTag.tsx` | `{ kind }` | EventRow |
| `ActionDot` | `timeline/cells/ActionDot.tsx` | `{ family }` | EventRow |
| `StatusCell` | `timeline/cells/StatusCell.tsx` | `{ status, isOrphan, isPending }` | EventRow |
| `LatencyCell` | `timeline/cells/LatencyCell.tsx` | `{ ms? }` | EventRow |
| `PayloadPreview` | `timeline/cells/PayloadPreview.tsx` | `{ raw }` | EventRow |
| `ParseErrorRow` | `timeline/ParseErrorRow.tsx` | `{ event }` | TimelineList (variant of EventRow) |
| `EmptyState` | `states/EmptyState.tsx` | `{ heading, body, icon? }` | TimelineRegion |
| `LoadingState` | `states/LoadingState.tsx` | `{ filename }` | TimelineRegion |
| `NoResultsBanner` | `states/NoResultsBanner.tsx` | `{ heading, body }` | TimelineRegion |
| `DisconnectedBanner` | `states/DisconnectedBanner.tsx` | `{ onReconnect }` | TimelineRegion |
| `ServerNotRunningState` | `states/ServerNotRunningState.tsx` | — | App root fallback |
| `DetailRailPlaceholder` | `detail/DetailRailPlaceholder.tsx` | `{ selectedEvent? }` | AppShell |

All components consume tokens via CSS variables or Tailwind v4 `@theme` mappings. No hard-coded color hex values inside component files.

---

## 12. Design Tokens — Final Manifest

Single source of truth file: `packages/ui/src/styles/tokens.css`. Loaded by `packages/ui/src/styles/global.css` before Tailwind layers.

```css
:root,
[data-theme="dark"] {
  /* Spacing */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --row-height: 28px;

  /* Typography */
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --text-row-size: 13px;
  --text-row-line: 20px;
  --text-ui-size: 13px;
  --text-ui-muted-size: 12px;
  --text-heading-size: 16px;
  --text-body-size: 14px;
  --weight-regular: 400;
  --weight-semibold: 600;

  /* Surface / chrome */
  --color-bg: #0E1116;
  --color-surface: #161A21;
  --color-surface-raised: #1C2129;
  --color-border: #262C36;
  --color-border-strong: #39414E;
  --color-accent: #7AA2F7;
  --color-accent-foreground: #0E1116;

  /* Text */
  --color-text: #E6E9EF;
  --color-text-muted: #A4ADBE;
  --color-text-subtle: #6B7385;
  --color-text-disabled: #4B5263;

  /* Semantic */
  --color-success: #7DCFA4;
  --color-warning: #E0AF68;
  --color-destructive: #F7768E;
  --color-info: #7DCFFF;

  /* Direction */
  --dir-c2s: #7AA2F7;
  --dir-s2c: #BB9AF7;
  --dir-internal: #A4ADBE;

  /* Kind */
  --kind-request: #7AA2F7;
  --kind-response: #7DCFA4;
  --kind-notification: #E0AF68;
  --kind-action: #BB9AF7;
  --kind-error: #F7768E;
  --kind-parse-error: #F7768E;

  /* Action taxonomy */
  --action-text: #7DCFA4;
  --action-tool-call: #7AA2F7;
  --action-tool-result: #9ECE6A;
  --action-status: #A4ADBE;
  --action-unknown: #6B7385;

  /* Latency */
  --latency-fast: #3A4A3F;
  --latency-normal: #3A4252;
  --latency-slow: #5A4A2E;
  --latency-critical: #5A2E36;
}
```

**Phase 5 contract:** `[data-theme="light"]` and `[data-theme="hacker"]` blocks override the same variable names. **No component file may reference any other variable name.** This is enforced via a Biome rule in Phase 5; in Phase 2 we enforce by code review and a single grep check in CI: `rg -n '#[0-9a-fA-F]{3,8}' packages/ui/src/components/` must return zero results.

---

## 13. Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (shadcn not initialized) |
| third-party | none | not applicable |

No component registries are used in Phase 2. All UI primitives are hand-built. Dependencies introduced in this phase: `react@19`, `react-dom@19`, `@tanstack/react-virtual@3`, `zustand@5`, `lucide-react`, `tailwindcss@4`, plus Phase 1 server packages. No CDN assets. Fonts vendored locally.

---

## 14. Acceptance Criteria for the UI Checker

- [ ] Spacing values used in components are all from the `--space-*` scale (or the documented `--row-height` exception). Grep: zero raw `px` literals in component files except `1px`/`2px` for borders/rails and the documented `--row-height: 28px`.
- [ ] Typography uses exactly the six declared roles across exactly four sizes (12/13/14/16) and two weights (400/600). No additional `font-size` or `font-weight` declarations.
- [ ] Two weight tiers active (400/600). No 500 / medium tier anywhere.
- [ ] Color: 60/30/10 surface split visible; accent appears only on selected-row rail, focus ring, and the `Retry connection` text button (text-color only). Grep: zero raw `#hex` in component source.
- [ ] All semantic state colors paired with glyph or label.
- [ ] Empty / loading / no-results / parse-error / disconnected / server-not-running states have copy matching §10 verbatim.
- [ ] Tooltips present on truncated values (Method, Session, Turn, Key IDs, Payload preview) and on Direction/Kind/Action/Latency cells.
- [ ] Keyboard navigation: Tab/Up/Down/PageUp/PageDown/Home/End/Esc behave per §9.1.
- [ ] `prefers-reduced-motion` honored on the loading spinner.
- [ ] Timeline renders as `role="grid"` with proper `aria-rowcount` / `aria-rowindex` / `aria-selected`.
- [ ] No CDN, no Google Fonts, no remote SVG. CSP `connect-src 'self'`.
- [ ] All declared tokens present in `packages/ui/src/styles/tokens.css`.
- [ ] Phase 5 theme contract preserved: only `[data-theme="dark"]` block defined; component files never reference unmapped variables.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS (FLAG: dense 12/13/14px scale accepted for devtool readability)
- [x] Dimension 5 Spacing: PASS (FLAG: documented 12px chrome-padding exception accepted)
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-07
