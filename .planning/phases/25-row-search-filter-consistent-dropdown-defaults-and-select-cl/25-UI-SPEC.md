---
phase: 25
slug: row-search-filter-consistent-dropdown-defaults-and-select-cl
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-29
revised: 2026-05-30
revision_note: Supersedes rejected adjacent-input layout per human checkpoint 2026-05-29/2026-05-30; Search moves to popup, Filter rows becomes sole primary toolbar input
---

# Phase 25 - UI Design Contract (Revised)

> Visual and interaction contract for row filtering and categorical visibility controls. Revised after human checkpoint rejection of the side-by-side Search/Filter rows toolbar composition.

## Source Contract

| Source | Binding UI Decision |
|--------|---------------------|
| `.planning/ROADMAP.md`, Phase 25 | Add projected-row filtering without changing Search highlight/navigation behavior; make categorical menus truthful visibility controls. |
| `.planning/phases/25-row-search-filter-consistent-dropdown-defaults-and-select-cl/25-RESEARCH.md` | Label the local filter `Filter rows`; preserve default-hidden `ping`; expose `Select all` and `Uncheck all`. |
| `.planning/phases/25-row-search-filter-consistent-dropdown-defaults-and-select-cl/25-VERIFICATION.md` | Human checkpoint rejected permanently side-by-side text inputs; requested toggle-button-style Search affordance. |
| `.planning/phases/25-row-search-filter-consistent-dropdown-defaults-and-select-cl/25-05-SUMMARY.md` | Verbatim feedback: "The side-by-side input boxes are ugly. I would prefer something like a toggle button." |
| `packages/ui/src/components/filters/SearchInput.tsx` | Existing Search input, `/` shortcut, Enter/Shift+Enter navigation to be preserved in popup form. |
| `packages/ui/src/styles/tokens.css` | Use existing semantic tokens and all three themes; do not add raw component colors. |

**Superseding decision (2026-05-30):** The always-visible side-by-side Search and Filter rows inputs are rejected. `Filter rows` becomes the sole persistent primary toolbar text input. Raw-event `Search` moves behind a compact toolbar trigger button that opens a raised popup containing the Search input and navigation controls.

## Experience Intent

This is a dense developer tool surface, not a new page or promotional treatment. A user scanning AHP traffic must be able to tell instantly whether they are filtering visible timeline rows or searching raw event payloads for highlight/navigation. The Search capability remains powerful but secondary to the persistent row-filter workflow; its popup reveals full functionality without cluttering the toolbar.

### User-Visible Truths

- `Filter rows` is the single persistent text input in the primary toolbar, occupying the flexible input slot, visibly labelled `Filter rows` with placeholder `Filter visible rows...` and a clear action.
- `Search` is a compact toolbar trigger button (lucide `Search` icon + "Search" label) that opens a raised popup containing the existing Search input, query, clear action, result status, and Previous/Next match controls.
- The Search trigger exposes an active/query state (visual indicator) when a search query is present.
- Search does not filter visible rows and does not appear in active filter chips; it highlights and navigates raw event payloads.
- Pressing the existing `/` shortcut opens the Search popup and focuses the Search input.
- Enter/Shift+Enter within the Search popup input navigates to next/previous match.
- Closing the Search popup does not clear the query or highlights; reopening restores the current Search query and status.
- Every categorical popover presents checked-as-visible state, including `ping` unchecked on initial defaults.
- Every categorical popover exposes `Select all` and `Uncheck all` commands using those exact labels.
- Active filter chips explain hidden values and row-text constraints without representing Search as a filter.

## Design System

| Property | Value |
|----------|-------|
| Tool | none; use existing hand-built React controls and semantic CSS tokens |
| Preset | not applicable |
| Component library | none |
| Icon library | `lucide-react`: `Search` for trigger, `Filter` for Filter rows, `X` for clear/dismiss actions, `ChevronUp`/`ChevronDown` for Prev/Next |
| Sans font | `var(--font-sans)` / Inter Variable |
| Mono font | `var(--font-mono)` / JetBrains Mono Variable |
| Border radius | 6px inputs, menu and popup surfaces; 4px active chips and trigger button; no larger new radii |

## Layout And Control Geometry

| Surface | Contract |
|---------|----------|
| Filter bar | Remains a compact operational toolbar with `minHeight: var(--filter-bar-height)` (`40px`), `var(--space-2)` (`8px`) gaps and `var(--space-3)` (`12px`) horizontal padding. |
| Filter rows input | The single flexible-width text input in the toolbar, visibly labelled `Filter rows` with `Filter` icon and clear `X` action. Uses `flex: 1 1 auto` with `minWidth: 200px` and `maxWidth: 480px` to fill available space while leaving room for facet triggers. |
| Search trigger button | Compact 28px-height button adjacent to Filter rows input, styled as secondary control. Contains lucide `Search` icon (16px) and "Search" label. When a query is active, displays a subtle active indicator (accent border or background tint). Button width adapts to content (~80px typical). |
| Search popup | Raised popover anchored below the Search trigger, opening downward. Contains: Search input (full width), status line with match count, and Prev/Next navigation buttons. Popup width: 320px minimum, 400px maximum. Height: auto (content-sized), max 200px. Uses `var(--shadow-menu)` and 6px border-radius. Must remain fully within viewport on both desktop and narrow widths. |
| Search input (in popup) | Full-width text input within popup, styled consistently with existing Search input: `Search all events` accessible label, lucide `Search` icon, clear `X` action when query present. |
| Facet triggers | Retain the existing 28px `FacetChip` height and compact chip styling for Dir, Kind, Method, Action, Channel, Turn, Status and Time. |
| Facet popovers | Retain raised menu surface, 6px radius, 180px minimum and 320px maximum width, 320px maximum height and `var(--shadow-menu)`. |
| Active chip strip | Retain `var(--filter-chips-height)` (`32px`), one-line non-wrapping compact chips, and right-aligned `Clear all`. |
| Desktop evidence | Fixture-backed verification must show Filter rows as sole toolbar input, Search trigger in default and active states, Search popup open state, facet chips and menu commands without overlap. |
| Narrow evidence | Fixture-backed verification must show controls remain coherent, Search popup remains within viewport, and no command labels are clipped. |

## Spacing Scale

Use only the existing 4px-grid tokens in this phase.

| Token | Value | Usage In Phase 25 |
|-------|-------|-------------------|
| `--space-1` | 4px | Icon/label spacing, checkbox row vertical padding, action padding, popup internal gaps |
| `--space-2` | 8px | Toolbar gaps, input icon inset, menu padding, chip content inset, popup padding |
| `--space-3` | 12px | Filter bar horizontal inset, popover option horizontal inset |
| `--space-4` | 16px | Reserved for surrounding layout only; do not expand compact filter controls to this padding |
| `--space-5` | 24px | Not used for new toolbar controls |
| `--space-6` | 32px | Input trailing affordance clearance only where already used |

Exceptions: None. Do not introduce off-grid spacing values for new controls.

## Typography

| Role | Size | Weight | Line Height | Use |
|------|------|--------|-------------|-----|
| Row/filter text entry | `var(--text-row-size)` (`13px`) | `var(--weight-regular)` (`400`) | `var(--text-row-line)` (`20px`) | Filter rows and Search popup text values, using `var(--font-mono)` |
| Compact UI label | `var(--text-ui-muted-size)` (`12px`) | `var(--weight-regular)` (`400`) | Existing compact control height | Facet rows, menu actions, active chips, Search trigger label, popup status |
| Input identity label | `var(--text-ui-muted-size)` (`12px`) | `var(--weight-semibold)` (`600`) | Existing compact control height | `Filter rows` inline label, `Search` trigger label |
| Body/help text | `var(--text-body-size)` (`14px`) | `var(--weight-regular)` (`400`) | Existing application default | Not introduced in the filter bar |

Text rules:

- Keep `Filter rows`, `Search`, `Select all`, `Uncheck all`, `Clear all`, and hidden-chip labels fully readable; do not abbreviate these commands.
- Keep current `Channel` terminology; do not reintroduce `Session` as a user-visible filter label.
- Do not scale type with viewport width or apply negative letter spacing.

## Color And Theme Contract

Phase 25 adds no color roles. Every new component must use semantic variables so Dark, Light and Hacker themes remain supported.

| Role | Token | Usage |
|------|-------|-------|
| Primary background | `var(--color-surface)` | Filter bar and chip strip |
| Raised control/menu background | `var(--color-surface-raised)` | Text inputs, Search popup, and facet popovers |
| Control border | `var(--color-border-strong)` | Text input and popup perimeter |
| Subtle dividers | `var(--color-border)` | Toolbar divider, menu sections, chip strip, popup internal dividers |
| Text | `var(--color-text)` | Entered values, options and selected-visible labels |
| Secondary text | `var(--color-text-muted)` | Icons, counts, placeholders, secondary commands, status text |
| Search trigger active state | `var(--color-chip-bg-active)` or subtle `var(--color-accent)` border | Indicates query is present without opening popup |
| Active/open chip | `var(--color-chip-bg-active)` | Existing active facet and active-filter treatment |
| Focus and checkbox accent | `var(--color-accent)` | 2px focus outline and native checkbox accent only |
| Dismiss hover | `var(--color-destructive)` | Existing `X` hover treatment only |

Accent reserved for focus rings and checked/native-selection affordances already established by the controls. Filtering must not introduce a new highlight color or compete with Search match highlighting.

## Copywriting Contract

| Element | Exact Copy |
|---------|------------|
| Persistent toolbar input label | `Filter rows` |
| Persistent toolbar input accessible label | `Filter rows` |
| Persistent toolbar input placeholder | `Filter visible rows...` |
| Clear row filter action accessible label | `Clear row filter` |
| Search trigger label | `Search` |
| Search trigger accessible label | `Open search` |
| Search popup input accessible label | `Search all events` |
| Search popup input placeholder | `all JSON payloads, methods, ids, sessions...` |
| Clear search action accessible label | `Clear search` |
| Previous match button | `Prev` with accessible label `Previous search match` |
| Next match button | `Next` with accessible label `Next search match` |
| Search status (searching) | `Searching...` |
| Search status (matches, focused) | `{N} of {M} matches` or `{N} of {M} match` (singular) |
| Search status (matches, unfocused) | `{M} matches` or `{M} match` (singular) |
| Search status (truncated suffix) | `+` appended to count |
| Search status (error) | `Search failed` or `Search failed: {reason}` |
| Facet bulk-visible action | `Select all` |
| Facet bulk-hidden action | `Uncheck all` |
| No facet options available | `No options` |
| Row text active chip | `Rows contain: {value}` |
| Hidden categorical active chip | `Hidden {label}: {value}` where `{label}` is `Dir`, `Kind`, `Method`, `Action`, `Channel`, `Turn`, or `Status` |
| Clear every active timeline filter action | `Clear all` with accessible name `Clear all filters` |

Copy exclusions:

- Do not call `Filter rows` a Search input, because Search has a broader raw-payload scope and different behavior.
- Do not use `Clear selection` in categorical menus; it hides the checked-visible meaning of an empty selection.
- Do not expose Search queries as active filter chips; Search is navigation, not filtering.
- Search trigger must not imply that Search filters visible rows.

## Interaction Contract

### Filter Rows (Primary Toolbar Input)

| State | Visible Behavior | Input / Action Contract |
|-------|------------------|-------------------------|
| Empty | Persistent text input with `Filter rows` label and `Filter` icon; no active row-text chip | Placeholder is `Filter visible rows...`; no timeline restriction. |
| Filled | Text remains in the input and a dismissible `Rows contain: {value}` chip appears in active chip strip | Literal, case-insensitive projected-row filtering only; no raw event search/navigation dispatch. |
| Clear icon | `X` icon is visible while text is present | Clears only `Filter rows`; Search query, results, and highlights remain intact. |
| Clear all filters | All timeline filtering chips disappear | Clears row text and categorical/time restrictions; does not clear Search query or highlights. |
| `/` shortcut | Opens Search popup instead of focusing Filter rows | Preserves existing Search-first shortcut behavior. |

### Search Trigger Button

| State | Visible Behavior |
|-------|------------------|
| Default (no query) | Compact button with `Search` icon + label; no active indicator. |
| Active (query present) | Subtle active indicator (accent border or background tint) visible even when popup is closed; indicates Search is engaged. |
| Popup open | Button appears pressed/selected; popup anchored below. |
| Click | Toggles Search popup open/closed. |
| `/` shortcut | Opens Search popup (if closed) and focuses Search input. |

### Search Popup

| State | Visible Behavior | Input / Action Contract |
|-------|------------------|-------------------------|
| Open | Raised popup below trigger with Search input, status line, Prev/Next buttons. | Popup anchored to trigger; positioned within viewport. |
| Input focus | Search input focused; `/` shortcut focuses here when popup opens. | Enter navigates to next match; Shift+Enter navigates to previous match. |
| Query present | Input shows query; status shows match count; Prev/Next enabled when matches exist. | Clear `X` clears query but does not close popup. |
| Query empty | Input shows placeholder; status hidden or shows no matches; Prev/Next disabled. | Closing popup does not change anything. |
| Close | Popup closes; Search query and highlights persist. | Click outside, Escape key, or click trigger closes popup. |
| Reopen | Popup shows current query and status from before close. | State is preserved across open/close cycles. |

### Categorical Visibility Menus

| State / Command | Visible Behavior |
|-----------------|------------------|
| Ordinary initial option | Checkbox is checked because the value is visible. |
| Initial `Method: ping` option | Checkbox is unchecked because `ping` remains intentionally hidden by application default. |
| User unchecks a value | The timeline hides matching rows and the chip strip displays `Hidden {label}: {value}`. |
| `Select all` | Every option in that facet becomes checked/visible, and hidden chips for those known options disappear. |
| `Uncheck all` | Every option in that facet becomes unchecked/hidden, with hidden-state feedback represented by active chips. |
| Popover-local option text filtering | Narrows menu options for inspection only; `Select all` and `Uncheck all` still operate on the complete facet option set. |
| Newly discovered option | Appears checked/visible unless the user has explicitly hidden that value. |

`Time` remains a range popover and must not gain `Select all` or `Uncheck all`. `Turn` remains operable when every Channel is visible.

## Accessibility And Feedback

- Use native text inputs, buttons and checkboxes with existing focus handling: a 2px `var(--color-accent)` outline must be visible for keyboard focus.
- The `Filter rows` icon is decorative; the input has the accessible label `Filter rows`, and its `X` has accessible label `Clear row filter`.
- The Search trigger button has accessible label `Open search`.
- The Search popup input has accessible label `Search all events`.
- The Search popup is a non-modal overlay; focus trapping is not required, but Escape closes the popup.
- `/` shortcut opens Search popup and focuses Search input; this is consistent with existing behavior.
- The two bulk menu actions (`Select all`, `Uncheck all`) are text buttons, not icon-only commands, because their visible meaning is essential to checkbox semantics.
- Keep checkbox labels and counts on one legible row; counts remain secondary in `var(--color-text-muted)`.
- A filtered timeline must communicate constraints through chips rather than relying on color alone.
- Search trigger active state provides visual feedback that a query is active without requiring the popup to be open.
- Fixture screenshot verification must cover desktop and narrow widths and all supported content must remain readable in the selected theme.

## Component Mapping

| Component | Required UI Result |
|-----------|--------------------|
| `packages/ui/src/components/filters/RowFilterInput.tsx` | Becomes the primary toolbar text input; token-styled flexible-width `Filter rows` input using `Filter` and `X` from `lucide-react`. Remove fixed 280px width; use flexible sizing. |
| `packages/ui/src/components/filters/SearchTrigger.tsx` (new) | Compact toolbar button with `Search` icon + "Search" label; manages popup open/closed state and active query indicator. |
| `packages/ui/src/components/filters/SearchPopover.tsx` (new) | Raised popup containing Search input, status line, Prev/Next buttons; preserves query across open/close; anchored to SearchTrigger. |
| `packages/ui/src/components/filters/SearchInput.tsx` | Refactored to work inside SearchPopover; retains existing input styling, clear action, Enter/Shift+Enter behavior. |
| `packages/ui/src/components/filters/FilterBar.tsx` | Hosts `RowFilterInput` as sole persistent text input, then `SearchTrigger`, then existing facet triggers; removes directly-mounted `SearchInput`. Preserves `Channel` label. |
| `packages/ui/src/components/filters/FacetPopover.tsx` | Keeps compact listbox visual language and `Select all` / `Uncheck all` commands. |
| `packages/ui/src/components/filters/ActiveFilterChips.tsx` | Shows row-text and hidden-value constraints; keeps Search out of filter chips. |
| `packages/ui/src/styles/tokens.css` | Source of all dimensions/colors; no Phase 25 token additions are required. |

## Verification Evidence Contract

| Evidence | Must Show |
|----------|-----------|
| Component tests | Exact labels `Filter rows`, `Search`, `Select all`, `Uncheck all`, `Rows contain:` and `Hidden Channel:`; Search trigger opens popup; `/` shortcut opens popup and focuses input; Search does not become a filter chip. |
| Fixture-backed desktop screenshot (Filter rows + trigger) | Filter rows is the sole persistent toolbar input; Search trigger shows default state; facet chips visible. |
| Fixture-backed desktop screenshot (Search popup open) | Search popup open below trigger; query, status, Prev/Next visible; popup within viewport. |
| Fixture-backed desktop screenshot (Search trigger active) | Search trigger shows active indicator when query is present and popup is closed. |
| Fixture-backed narrow screenshot | Controls remain coherent with no overlap; Search popup remains within viewport; no command label truncation. |
| Fixture-backed facet menu screenshot | `Select all` and `Uncheck all` readable; `ping` unchecked state evident when Method is open. |
| Theme safety | New elements render only from semantic CSS variables and therefore inherit Dark, Light and Hacker themes. |

Screenshots must be captured only from repository fixtures or synthetic rows and saved under `screenshots/phase25/`. Explicit human approval required after gap implementation.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registry | none | no external component blocks permitted for this compact extension |

This phase uses the app's existing local components, CSS token system and installed `lucide-react` icons only; it introduces no CDN asset, registry block or new visual dependency.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS - distinct Search/filter nouns, popup copy, and explicit all/none command text are defined.
- [x] Dimension 2 Visuals: PASS - Filter rows as sole toolbar input, Search trigger + popup, facet chips, and evidence geometry are defined.
- [x] Dimension 3 Color: PASS - semantic token-only usage is defined for all surfaces and states including Search trigger active indicator.
- [x] Dimension 4 Typography: PASS - existing Inter/JetBrains Mono roles and fixed token sizes are defined.
- [x] Dimension 5 Spacing: PASS - existing 4px-grid tokens, popup dimensions, and fixed control heights are defined.
- [x] Dimension 6 Registry Safety: PASS - existing local components and Lucide icons only; no registry or external assets.

**Revision Note:** This contract supersedes the rejected adjacent-input layout based on human checkpoint feedback dated 2026-05-29/2026-05-30. The previous approval (2026-05-29) is voided; this revision requires re-verification with new fixture-only screenshots and explicit human visual approval.

**Approval:** approved (revised) 2026-05-30
