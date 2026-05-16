import type { EventRow } from "@ahp-inspector/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store.js";

function row(
  idx: number,
  sessionId: string | null = null,
  kind: EventRow["kind"] = "request",
): EventRow {
  return {
    idx,
    seq: idx,
    ts: 0,
    tsFmt: "00:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind,
    kindTag: kind === "response" ? "RES" : "REQ",
    method: null,
    actionType: null,
    actionFamily: null,
    sessionId,
    sessionShort: sessionId?.slice(0, 4) ?? null,
    turnId: null,
    turnShort: null,
    keyId: null,
    status: "pending",
    latencyMs: null,
    latencyBand: null,
    payloadPreview: "",
    parseErrorReason: null,
    lineIndex: idx,
  } as unknown as EventRow;
}

describe("useAppStore", () => {
  beforeEach(() => {
    const s = useAppStore.getState();
    s.setRows([]);
    s.setMeta(null);
    s.selectIdx(null);
    s.setConnection("connecting");
    useAppStore.setState({
      livePaused: false,
      pendingBuffer: [],
      pendingNewCount: 0,
      loadProgress: { phase: "idle", loadedRows: 0, loadedBytes: 0 },
      streamBacklog: { queuedFrames: 0, queuedRows: 0 },
      searchQuery: "",
      searchMatches: null,
      searchTotal: 0,
      searchTruncated: false,
      searchStatus: "idle",
      searchError: null,
    });
  });

  it("setRows replaces and updates meta when meta exists", () => {
    const s = useAppStore.getState();
    s.setMeta({ filename: "a.jsonl", eventCount: 0, sessionCount: 0 });
    s.setRows([row(0, "S1"), row(1, "S2"), row(2, "S1")]);
    const { rows, meta } = useAppStore.getState();
    expect(rows).toHaveLength(3);
    expect(meta?.eventCount).toBe(3);
    expect(meta?.sessionCount).toBe(2);
  });

  it("appendRows writes from index", () => {
    const s = useAppStore.getState();
    s.setRows([row(0), row(1)]);
    s.appendRows([row(2), row(3)], 2);
    expect(useAppStore.getState().rows).toHaveLength(4);
  });

  it("appendSnapshotRows publishes baseline rows even while live append buffering is paused", () => {
    const s = useAppStore.getState();
    s.setMeta({ filename: "a.jsonl", eventCount: 0, sessionCount: 0 });
    s.setLivePaused(true);

    s.appendSnapshotRows([row(0), row(1)], 0);

    expect(useAppStore.getState().rows).toHaveLength(2);
    expect(useAppStore.getState().pendingBuffer).toHaveLength(0);
    expect(useAppStore.getState().pendingNewCount).toBe(0);
  });

  it("stores explicit baseline load progress with optional percent", () => {
    const s = useAppStore.getState();
    s.setLoadProgress({
      phase: "loading",
      loadedRows: 20,
      loadedBytes: 50,
      totalBytes: 100,
      percent: 50,
    });
    expect(useAppStore.getState().loadProgress).toMatchObject({ phase: "loading", percent: 50 });

    s.setLoadProgress({ phase: "loading", loadedRows: 20, loadedBytes: 50 });
    expect(useAppStore.getState().loadProgress).not.toHaveProperty("percent");
  });

  it("keeps stream backlog separate from pendingNewCount and clears it on rotation", () => {
    const s = useAppStore.getState();
    s.setLivePaused(true);
    s.appendRows([row(0)], 0);
    s.setStreamBacklog({ queuedFrames: 2, queuedRows: 8 });

    expect(useAppStore.getState().pendingNewCount).toBe(1);
    expect(useAppStore.getState().streamBacklog).toEqual({ queuedFrames: 2, queuedRows: 8 });

    s.resetForRotation();
    expect(useAppStore.getState().pendingNewCount).toBe(0);
    expect(useAppStore.getState().streamBacklog).toEqual({ queuedFrames: 0, queuedRows: 0 });
  });

  it("applyPatch updates status/latency", () => {
    const s = useAppStore.getState();
    s.setRows([row(0), row(1)]);
    s.applyPatch([{ idx: 1, status: "ok", latencyMs: 12, latencyBand: "fast" }]);
    const r = useAppStore.getState().rows[1];
    if (!r) throw new Error("expected patched row");
    expect(r.status).toBe("ok");
    expect(r.latencyMs).toBe(12);
    expect(r.latencyBand).toBe("fast");
  });

  it("applyPatch updates summary and pairIdx when present", () => {
    const s = useAppStore.getState();
    s.setRows([row(0), row(1)]);
    s.applyPatch([
      {
        idx: 0,
        status: "ok",
        latencyMs: 12,
        latencyBand: "fast",
        summary: "doThing result ok=true",
        pairIdx: 1,
      },
    ]);
    const r = useAppStore.getState().rows[0];
    if (!r) throw new Error("expected patched row");
    expect(r.summary).toBe("doThing result ok=true");
    expect(r.pairIdx).toBe(1);
  });

  it("applyPatch updates rows buffered while live follow is paused before flush", () => {
    const s = useAppStore.getState();
    s.setRows([]);
    s.setLivePaused(true);

    s.appendRows([row(0)], 0);
    s.appendRows([row(1, null, "response")], 1);
    s.applyPatch([
      {
        idx: 0,
        status: "ok",
        latencyMs: 42,
        latencyBand: "fast",
        summary: "initialize response ok=true",
        pairIdx: 1,
      },
    ]);
    s.setLivePaused(false);
    s.flushPendingBuffer();

    const request = useAppStore.getState().rows[0];
    if (!request) throw new Error("expected flushed request row");
    expect(request.status).toBe("ok");
    expect(request.latencyMs).toBe(42);
    expect(request.latencyBand).toBe("fast");
    expect(request.summary).toBe("initialize response ok=true");
    expect(request.pairIdx).toBe(1);
    expect(useAppStore.getState().pendingBuffer).toHaveLength(0);
    expect(useAppStore.getState().pendingNewCount).toBe(0);
  });

  it("selectIdx and clearSelection", () => {
    const s = useAppStore.getState();
    s.selectIdx(3);
    expect(useAppStore.getState().selectedIdx).toBe(3);
    s.clearSelection();
    expect(useAppStore.getState().selectedIdx).toBeNull();
  });

  it("setConnection updates connection", () => {
    useAppStore.getState().setConnection("connected");
    expect(useAppStore.getState().connection).toBe("connected");
  });

  it("stores search result metadata and clears only volatile results", () => {
    const s = useAppStore.getState();
    s.setSearchQuery("initialize");
    s.setSearchPending();
    expect(useAppStore.getState().searchStatus).toBe("searching");

    s.setSearchResult([1, 3], 2, true);
    expect(useAppStore.getState().searchMatches).toEqual(new Set([1, 3]));
    expect(useAppStore.getState().searchTotal).toBe(2);
    expect(useAppStore.getState().searchTruncated).toBe(true);
    expect(useAppStore.getState().searchStatus).toBe("ready");

    s.clearSearchResults();
    expect(useAppStore.getState().searchQuery).toBe("initialize");
    expect(useAppStore.getState().searchMatches).toBeNull();
    expect(useAppStore.getState().searchTotal).toBe(0);
    expect(useAppStore.getState().searchTruncated).toBe(false);
    expect(useAppStore.getState().searchStatus).toBe("idle");
  });

  it("clearFilters does not clear search query or results", () => {
    const s = useAppStore.getState();
    s.setSearchQuery("needle");
    s.setSearchResult([0], 1, false);
    s.clearFilters();
    expect(useAppStore.getState().searchQuery).toBe("needle");
    expect(useAppStore.getState().searchMatches).toEqual(new Set([0]));
  });
});
