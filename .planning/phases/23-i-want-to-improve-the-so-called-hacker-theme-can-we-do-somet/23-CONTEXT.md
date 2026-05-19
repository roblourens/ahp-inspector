# Phase 23: Hacker theme CRT overhaul - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the existing Hacker theme into an aggressively stylized whole-screen CRT presentation. The phase should preserve the current theme architecture and shared UI runtime while adding a clearly visible curved-glass screen treatment, richer analog artifacts, and ambient CRT motion. Dark and Light remain unchanged; Phase 23 is about making Hacker intentionally theatrical rather than adding a general-purpose display-effects system.

</domain>

<decisions>
## Implementation Decisions

### Screen warp character
- **D-01:** Hacker mode should use a visibly curved-glass whole-screen CRT warp, not merely stronger overlays on a flat UI.
- **D-02:** The curved-glass treatment applies to the entire app surface: header, timeline, detail panel/drawer, menus, and shared overlays should read as part of one CRT display.
- **D-03:** The display should include a dark glass/tube edge treatment so the viewport feels physically enclosed.
- **D-04:** Start aggressive. Distortion should be felt across the full screen, not only at the corners; the team can reduce intensity later if the result overshoots.

### Artifact intensity mix
- **D-05:** Use a full analog stack: curvature, stronger scanlines, vignette/glass shading, phosphor glow, subtle noise, and color fringe should work together.
- **D-06:** Prefer a stylized-first result over near-neutral legibility. Hacker should feel dramatically transformed, while remaining a usable inspection mode rather than an unreadable novelty.
- **D-07:** Chromatic/RGB separation should be present but weighted toward the display edges rather than splitting every character equally across the whole viewport.
- **D-08:** The surface should feel alive and imperfect through fine noise and occasional analog instability, without turning into constant broadcast grit.

### Motion and comfort
- **D-09:** Default motion should feel like a restless analog screen: continuous low-level drift with occasional stronger signal beats.
- **D-10:** Momentary glitches should be visibly noticeable, not merely subliminal, but should remain occasional rather than relentless.
- **D-11:** `prefers-reduced-motion: reduce` keeps the static CRT identity but removes animated drift, pulses, and glitches.
- **D-12:** CRT motion should remain mostly ambient. Hover, scrolling, selection, and focus retain their existing product feedback instead of stirring a new interaction-reactive effect system.

### Theme controls and scope
- **D-13:** CRT treatment belongs to Hacker only. Dark and Light stay visually clean.
- **D-14:** The CRT effect is Hacker's default identity. Selecting Hacker enables the full treatment; switching themes is the immediate escape hatch.
- **D-15:** Do not add an intensity slider, Calm/Bold/Extreme preset, or other configuration surface in this phase. Ship one bold curated treatment first.
- **D-16:** The shared UI should render the same Hacker CRT identity in both the standalone browser viewer and the VS Code extension webview.

### the agent's Discretion
- Decide the exact CSS/SVG/filter/compositing technique that best creates the warp and analog stack while fitting the existing app structure.
- Decide the precise timing, opacity, transform, and keyframe values that implement the locked aggressive direction.
- Decide how to balance the bold visual direction against the existing Phase 22 responsiveness posture during implementation and verification.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project posture and prior decisions
- `.planning/PROJECT.md` — Defines the shipped local-first product, the shared UI runtime, and the established token-driven theme direction.
- `.planning/STATE.md` — Captures prior theme decisions plus Phase 22's responsiveness posture that should remain intact while visual complexity increases.
- `.planning/phases/22-improve-large-log-loading-and-high-throughput-live-tail-perf/22-CONTEXT.md` — Keeps interaction responsiveness and visible progress truthful under load; Phase 23 should not casually undo that user experience.

### Current theme implementation
- `packages/ui/src/styles/tokens.css` — Hacker color tokens and existing effect tokens (`--effect-scanline-opacity`, `--effect-grid-opacity`, `--effect-noise-opacity`, glow tokens).
- `packages/ui/src/styles/global.css` — Existing Hacker scanline/grid/vignette overlays, glow hooks, animation keyframes, and reduced-motion handling.
- `packages/ui/src/theme/theme.ts` — Theme IDs and global `ahp-theme` persistence contract.
- `packages/ui/src/components/shell/HeaderBar.tsx` — Theme picker behavior; Phase 23 keeps Hacker as a normal theme selection rather than introducing a new control surface.
- `packages/ui/src/components/shell/AppShell.tsx` — Shared UI shell used by standalone and extension contexts; useful for understanding the full-surface effect target.

`.planning/REQUIREMENTS.md` was not present in the repository when this context was gathered. Downstream planning should use the roadmap, project/state docs, this context, and archived milestone requirements only where historical reference is needed.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ui/src/styles/tokens.css`: Hacker already owns dedicated effect opacity and glow tokens, giving Phase 23 a natural token surface to expand rather than scattering magic values through components.
- `packages/ui/src/styles/global.css`: Hacker already renders fixed `body::before`/`body::after` overlays, root inset glow, scanline drift, CRT pulse animation, and reduced-motion overrides; Phase 23 can evolve these established effect layers.
- `packages/ui/src/theme/theme.ts`: Theme application remains a single `data-theme` attribute plus persisted `ahp-theme` key.

### Established Patterns
- Visual theme differences live in tokens and shared global styling, not bespoke per-component conditionals.
- Existing reduced-motion support removes animation while preserving the rest of the visual system; Phase 23 extends that pattern.
- The theme picker exposes three peers, Dark/Light/Hacker. Phase 23 changes Hacker's identity, not the picker information architecture.

### Integration Points
- Whole-screen CRT effects naturally connect at the shared document/root shell layer already used by Hacker overlays.
- Shared UI runtime means a theme-level implementation reaches both standalone and VS Code webview usage without runtime-specific branching unless research identifies a hard platform constraint.
- Existing selected-row/header/detail glow hooks show where accent emphasis already exists and should remain coherent with the stronger CRT layer.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants to start "as far as we reasonably can" rather than biasing toward caution, then back off later only if the result is too much.
- The previous edge-focused warp preference was corrected during discussion: distortion should be felt across the full screen.
- The existing scanline/grid Hacker treatment is a starting point, not the finish line; the new phase should feel like a material upgrade.

</specifics>

<deferred>
## Deferred Ideas

- User-adjustable CRT intensity controls or presets can be reconsidered later if the bold default needs productized tuning.
- Applying CRT effects to Dark/Light, or introducing a theme-independent display-effects mode, is intentionally out of Phase 23 scope.

</deferred>

---

*Phase: 23-hacker-theme-crt-overhaul*
*Context gathered: 2026-05-16*
