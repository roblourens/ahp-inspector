// Projector — re-export of AppState's row projection seam.
//
// AppState owns the actual buildRow + diff-emit logic (the projection lives
// inline because it needs direct access to EventStore + Correlator state).
// This file exists so callers wanting a "Projector" symbol get one, and so
// future plans can refactor projection into a standalone class without
// breaking import sites.

export { createAppState as Projector } from "./app-state.js";
export type { AppState, AppStateOptions, LogMeta, SsePayload, Listener } from "./app-state.js";
