# Phase 22: Improve large-log loading and high-throughput live tail performance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 22-improve-large-log-loading-and-high-throughput-live-tail-perf
**Areas discussed:** First useful view, Burst tail behavior

---

## First useful view

### Question 1: When should timeline rows first appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Progressively during load | Show rows in batches as they become available. | Free-text answer favored this direction |
| Only after full baseline | Keep the current coherent one-shot baseline behavior. | |
| Agent decides | Let research choose from measured cost and risk. | |

**User's choice:** Show content as quickly as possible, keep the UI responsive while content is loading, and show a progress indicator with a percentage estimate if feasible.
**Notes:** This answer also established the user's loading-feedback preference even though loading feedback was not selected as a separate gray area.

### Question 2: What should loaded rows support while the rest is still loading?

| Option | Description | Selected |
|--------|-------------|----------|
| Normal inspection | Rows are selectable and details can open immediately. | Yes |
| Browse first, inspect later | Show rows early, but defer heavier detail actions. | |
| Agent decides | Let research choose the boundary. | |

**User's choice:** Normal inspection.
**Notes:** The partially loaded viewer should feel genuinely usable, not merely animated.

### Question 3: How should search and filters behave before the full baseline finishes?

| Option | Description | Selected |
|--------|-------------|----------|
| Work on loaded rows, label partial | Queries operate over loaded data with an incomplete-results cue. | |
| Hold until fully loaded | Preserve globally complete query semantics until ingestion ends. | |
| Agent decides | Let research decide. | Yes |

**User's choice:** Agent decides.
**Notes:** This remains open for research and planning.

### Question 4: What should happen to the viewport as more initial-load rows stream in?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep view stable | Avoid moving the user's viewport once they begin inspecting. | Yes |
| Follow newest loaded rows | Keep advancing toward the newest available rows. | |
| Agent decides | Align with current live-follow behavior. | |

**User's choice:** Keep view stable.
**Notes:** Progressive loading must not make inspection frustrating.

---

## Burst tail behavior

### Question 1: What should the viewer favor during heavy live append floods?

| Option | Description | Selected |
|--------|-------------|----------|
| Protect interaction first | Batch enough to keep scrolling, selection, and detail inspection responsive. | Yes |
| Show every event ASAP | Prefer minimal freshness lag even if UI smoothness suffers. | |
| Agent decides | Let measurements choose the operating point. | |

**User's choice:** Protect interaction first.
**Notes:** Responsiveness outranks maximum per-event immediacy under burst load.

### Question 2: How should follow-latest behave during a burst?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay live, but smooth | Continue following, coalescing updates enough to avoid jitter. | Yes |
| Pause follow on heavy bursts | Stop automatically and ask the user to resume. | |
| Agent decides | Let research align with current live-follow behavior. | |

**User's choice:** Stay live, but smooth.
**Notes:** Heavy appends should not force an unsolicited mode change.

### Question 3: Should a short buffered backlog be visible?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, compact backlog cue | Show a small count or status when visible rows are behind. | Yes |
| No extra cue | Keep the UI quiet; short lag is acceptable. | |
| Agent decides | Decide whether current affordances suffice. | |

**User's choice:** Yes, compact backlog cue.
**Notes:** Slight delay is fine, but it should not be invisible.

### Question 4: May rows appear before derived pair/status metadata fully settles?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, rows first | Timely visible rows matter; derived metadata may catch up shortly after. | Yes |
| No, rows should arrive fully settled | Prefer fewer updates with coherent metadata at display time. | |
| Agent decides | Let research decide whether deferral helps. | |

**User's choice:** Yes, rows first.
**Notes:** This gives research room to decouple visible arrival from patch-like derived metadata work.

---

## the agent's Discretion

- Decide partial-load search/filter semantics.
- Decide when a percentage progress estimate is trustworthy and what fallback to use if it is not.
- Decide the concrete batching, scheduling, and metadata-settling approach.

## Deferred Ideas

None.