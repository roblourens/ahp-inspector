# Phase 23: Hacker theme CRT overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 23-hacker-theme-crt-overhaul
**Areas discussed:** Screen warp character, Artifact intensity mix, Motion and comfort, Theme controls and scope

---

## Screen warp character

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Warp strength | Visible curved glass | Mild edge bow; No geometry warp |
| Coverage | Entire app surface | Main viewer only; Background shell only |
| Edge treatment | Dark glass edge | Frameless distortion; Minimal edge cue |
| Distortion placement | Across the full screen | Edges and corners; Top/bottom roll feel |

**User's choice:** Build an aggressive whole-screen curved-glass CRT treatment, visibly enclosing the interface in a dark display edge.
**Notes:** The first pass briefly selected edge/corner emphasis. The user corrected that immediately: the phase should start aggressive, with distortion felt across the full screen, and back off later only if it proves excessive.

---

## Artifact intensity mix

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Artifact recipe | Full analog stack | Curvature-led; Texture-led |
| Legibility tradeoff | Stylized first | Readable but unmistakable; Nearly no tradeoff |
| RGB fringe | Mostly at edges | Visible across image; Skip it |
| Surface texture | Alive and imperfect | Steady phosphor glass; Harsh broadcast grit |

**User's choice:** Make Hacker feel dramatically transformed through a layered analog treatment, accepting some aesthetic interference so long as the mode remains usable.
**Notes:** The user wants a bolder result than the current scanline/grid treatment, not a restrained polishing pass.

---

## Motion and comfort

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Motion personality | Restless analog screen | Slow ambient display; Mostly still with rare hits |
| Glitch visibility | Occasional visible jolts | Tiny subliminal variations; Frequent theatrical glitches |
| Reduced-motion response | Keep static CRT, remove motion | Substantially soften all effects; Leave Hacker unchanged |
| Interaction coupling | Mostly ambient | Reactive highlights; Reactive everywhere |

**User's choice:** Hacker should feel alive on its own, with occasional visible signal instability, while reduced-motion users keep the static visual identity without animation.
**Notes:** Motion should not become a new interaction-feedback system layered onto hover, selection, or scrolling.

---

## Theme controls and scope

| Decision | Selected | Alternatives considered |
|----------|----------|-------------------------|
| Theme scope | Hacker only | Hacker plus optional dark; Global display mode |
| Exposure model | Default Hacker identity | Hacker with CRT toggle; Let planner decide |
| Tuning controls | No slider, start bold | Simple intensity preset; Fine-grained intensity control |
| Runtime scope | Shared UI everywhere | Standalone only; Let planner decide |

**User's choice:** Hacker itself becomes the CRT mode. Dark and Light stay clean, no extra intensity control is added now, and shared UI behavior should match in standalone and extension contexts.
**Notes:** Switching away from Hacker is the intended immediate escape hatch for users who do not want the effect.

---

## the agent's Discretion

- Exact rendering technique for warp, overlays, and compositing.
- Exact animation timings, opacity values, transforms, and glitch cadence that satisfy the locked visual direction.
- Verification strategy for preserving responsiveness while increasing visual intensity.

## Deferred Ideas

- Adjustable CRT intensity presets or sliders, if the bold curated default later needs a productized tuning surface.
- CRT as a global display mode for Dark or Light themes.
