---
phase: 17
slug: add-drag-and-drop-support-for-opening-jsonl-files
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-12
approved: 2026-05-12
---

# Phase 17 — UI Design Contract

> Visual and interaction contract for the standalone-web drag-and-drop file-open overlay. Reuses the existing dark-theme token set in `packages/ui/src/styles/tokens.css`. No new design-system or component-library dependencies.

This contract covers **two** UI surfaces introduced in Phase 17:

1. **DropOverlay** — full-viewport drop region with idle / armed / error / success states.
2. **MultiFileToast** — bottom-center transient notice when more than one file is dropped.

Everything else (timeline, picker panel, shell chrome) is unchanged.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn) |
| Preset | not applicable |
| Component library | none (inline-styled React, consistent with `ManualOpenInput.tsx` / `LogPickerPanel.tsx`) |
| Icon library | none for this phase (overlay uses a single Unicode glyph `↧` or none) |
| Font | `var(--font-sans)` for overlay copy; `var(--font-mono)` for the dropped path basename |

Reuse only — no new tokens, no new font, no new icon dependency.

---

## Spacing Scale

Existing tokens (already multiples of 4 in `tokens.css`):

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| `--space-1` | 4px  | Tight gaps inside overlay copy |
| `--space-2` | 8px  | Toast inner padding rows |
| `--space-3` | 12px | Overlay heading-to-body gap; toast horizontal padding |
| `--space-4` | 16px | Overlay card padding (vertical) |
| `--space-5` | 24px | Overlay card padding (horizontal) |
| `--space-6` | 32px | Toast bottom offset from viewport edge |

Exceptions: none. The overlay card uses tokens only; no ad-hoc px values.

---

## Typography

Driven entirely by existing tokens. No new sizes.

| Role | Size | Weight | Line height | Token usage |
|------|------|--------|-------------|-------------|
| Overlay heading | 16px | 600 | 1.4 | `var(--text-heading-size)` + `var(--weight-semibold)` |
| Overlay body | 14px | 400 | 1.45 | `var(--text-body-size)` + `var(--weight-regular)` |
| Overlay error | 14px | 400 | 1.45 | `var(--text-body-size)`, color `var(--color-destructive)` |
| Toast text | 13px | 400 | 1.4 | `var(--text-ui-size)` |
| Dropped basename inline | 13px | 400 | 1.4 | `var(--text-ui-size)`, `var(--font-mono)` |

---

## Color

Reuse the dark theme tokens. No hex literals in components (enforced by `no-hex-in-components.test.ts`).

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--color-bg)` | Overlay scrim base, painted at 80% alpha (`color-mix(in srgb, var(--color-bg) 80%, transparent)`). |
| Secondary (30%) | `var(--color-surface-raised)` | Overlay card background; toast background |
| Accent (10%) | `var(--color-accent)` | Dashed border on armed overlay card; toast left border accent |
| Destructive | `var(--color-destructive)` | Overlay error text + dashed border in error state |

Accent reserved for: **(a)** the 2px dashed border of the overlay card while a valid drag is in progress, and **(b)** a 2px left border on the multi-file toast. Accent is **not** used for body text, icons, or affordances elsewhere in this phase.

The overlay scrim uses `backdrop-filter: blur(2px)` (matches the Phase 11 picker panel treatment) for visual layering. Falls back to a flat scrim where unsupported.

---

## Copywriting Contract

Authoritative strings. Drop handler must use these verbatim; tests will assert.

| Element | Copy |
|---------|------|
| Overlay armed (no active log) | **Drop a .jsonl file to open.** |
| Overlay armed body (no active log) | Drag from Finder, Explorer, or VS Code's file tree. |
| Overlay armed (replacing active log) | **Drop to replace the active log.** |
| Overlay armed body (replacing) | The current log will close and the new file will start tailing. |
| Overlay error — no file URI | **That drop didn't include a file path.** Try dragging from Finder or VS Code's file tree, or paste a path in the picker below. |
| Overlay error — wrong extension | **Only .jsonl files are supported.** Drop the raw AHP log file. |
| Overlay error — server reject (uses existing `ManualOpenInput` table) | Reuse `ERROR_COPY` from `ManualOpenInput.tsx` verbatim. |
| Toast — multiple files | **Opened `{basename}`. Ignored {N} other file{N>1?'s':''}.** |
| Toast — dismiss button aria-label | Dismiss notice |

Error states never echo the absolute path or a `file://` URI back to the user; only the basename appears in the toast (consistent with the Phase 11 trust posture and the server's T-04-03-02 rule).

---

## Interaction States

The DropOverlay is a state machine driven by `window` drag events.

| State | Trigger | Visual |
|-------|---------|--------|
| `idle` | default | Overlay element rendered but `display: none`. No event listeners on `<body>` other than the always-on `dragenter` capture. |
| `armed` | `dragenter` carrying `Files` | Overlay fades in (150ms). Card centered, dashed accent border, "armed" copy. `aria-live` announces the heading. |
| `armed-replacing` | `armed` + an active log is open | Same as `armed` but uses the "replace" copy variant. |
| `error` | `drop` produced no usable path or wrong extension | Card stays mounted. Border switches to destructive. Error copy + a "Dismiss" button (`Esc` also dismisses). Persists until user dismisses or starts a new drag. |
| `success-transient` | `drop` succeeded | Overlay fades out immediately (no success copy in the overlay). Multi-file toast shown only if N > 1. |

Event handling rules (locked):

- The overlay's `dragenter`/`dragover` handlers call `preventDefault()` so the browser does not navigate to the dropped file.
- `dragleave` only disarms when leaving the document edge (`event.relatedTarget == null`), to avoid flicker when crossing nested children.
- `drop` always calls `preventDefault()`; the file is never opened by the browser.
- Keyboard: `Esc` dismisses the error state. The overlay is not focus-trapping; idle and success states leave focus untouched.
- The overlay sits at `z-index: 1000` (above `LogPickerPanel`'s 100, below any future modal).

---

## Layout

ASCII sketch (armed state, no active log; viewport ≈ 1280×800):

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                                                          │
│           ╔══════════════════════════════════╗           │
│           ║                                  ║           │
│           ║   Drop a .jsonl file to open.    ║           │
│           ║                                  ║           │
│           ║   Drag from Finder, Explorer,    ║           │
│           ║   or VS Code's file tree.        ║           │
│           ║                                  ║           │
│           ╚══════════════════════════════════╝           │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
                                              ┌──────────────────┐
                                              │ Opened tiny.jsonl│
                                              │ Ignored 2 files. │
                                              └──────────────────┘
```

- Overlay scrim: full viewport, fixed positioned.
- Card: max-width 480px, centered horizontally, 35% from top (so it sits above the centerline and doesn't overlap a low-positioned cursor on small viewports).
- Card padding: `var(--space-4) var(--space-5)`.
- Card border: 2px dashed `var(--color-accent)` (armed/armed-replacing) or `var(--color-destructive)` (error).
- Toast: fixed, bottom-right, `bottom: var(--space-6)`, `right: var(--space-6)`. Width auto, max 360px.

---

## Accessibility

- Overlay container: `role="region"`, `aria-label="Drop a log file"`, with an inner element `aria-live="polite"` for state announcements.
- Error state: error text inside a `role="alert"` (mirrors the existing `ManualOpenInput` error pattern, one source of error semantics).
- Toast: `role="status"`, auto-dismisses after 5s. `Esc` while focused on the toast dismisses early.
- All non-button text uses sufficient contrast against `--color-surface-raised`: `--color-text` (≥ 7:1), `--color-text-muted` (≥ 4.5:1).
- No motion past the 150ms fade. The fade is suppressed under `prefers-reduced-motion: reduce` (consistent with the existing `reduced-motion-css.test.ts` regime).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not required |

No registry blocks. Pure inline-styled React + CSS variables, identical pattern to existing `LogPickerPanel.tsx` and `ManualOpenInput.tsx`.

---

## Out of Scope

- Native file-picker fallback (`<input type="file">`).
- Folder-drop visual cues (folder drops fall through to the "no file path" error variant).
- Animations richer than a 150ms opacity fade.
- VS Code extension webview drop visuals (separate phase).
- A persistent history of recently-opened logs.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — every user-visible string locked above; no ad-hoc copy in the implementation.
- [x] Dimension 2 Visuals: PASS — single layout sketch, locked positioning + sizing.
- [x] Dimension 3 Color: PASS — accent reserved to 2 specific affordances; dest. reserved to error border + text; all values via tokens, no hex.
- [x] Dimension 4 Typography: PASS — only existing token sizes, weights and families.
- [x] Dimension 5 Spacing: PASS — only `--space-*` tokens, all multiples of 4.
- [x] Dimension 6 Registry Safety: PASS — no registry usage; matches existing inline-styled component pattern.

**Approval:** approved 2026-05-12 (the agent self-approved per workflow step 9 — no separate UI checker agent registered; copy + token reuse mirrors locked patterns from `ManualOpenInput.tsx` and `LogPickerPanel.tsx`).
