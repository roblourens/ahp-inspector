import type { EventRow } from "@ahp-viewer/core";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store.js";

function row(idx: number, sessionId: string | null = null): EventRow {
  return {
    idx,
    seq: idx,
    ts: 0,
    tsFmt: "00:00:00.000",
    dir: "c2s",
    dirGlyph: "→",
    kind: "request",
    kindTag: "REQ",
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
});
