import { describe, expect, it } from "vitest";
import { extractWireMeta } from "./wire-meta.js";

describe("extractWireMeta", () => {
  it("returns null for non-objects", () => {
    expect(extractWireMeta(null)).toBeNull();
    expect(extractWireMeta(undefined)).toBeNull();
    expect(extractWireMeta("string")).toBeNull();
    expect(extractWireMeta(42)).toBeNull();
    expect(extractWireMeta(true)).toBeNull();
    expect(extractWireMeta([])).toBeNull();
  });

  it("returns null when _ahpLog is missing or not an object", () => {
    expect(extractWireMeta({})).toBeNull();
    expect(extractWireMeta({ _ahpLog: null })).toBeNull();
    expect(extractWireMeta({ _ahpLog: "x" })).toBeNull();
    expect(extractWireMeta({ _ahpLog: 5 })).toBeNull();
  });

  it("returns null when ts is missing, empty, or non-string", () => {
    expect(extractWireMeta({ _ahpLog: {} })).toBeNull();
    expect(extractWireMeta({ _ahpLog: { ts: "" } })).toBeNull();
    expect(extractWireMeta({ _ahpLog: { ts: 42 } })).toBeNull();
    expect(extractWireMeta({ _ahpLog: { ts: null } })).toBeNull();
  });

  it("returns null when ts is unparseable", () => {
    expect(extractWireMeta({ _ahpLog: { ts: "not-a-date" } })).toBeNull();
  });

  it("returns parsed ts + tsRaw + dir for c2s", () => {
    const wireTs = "2026-05-11T17:11:14.356Z";
    const meta = extractWireMeta({ _ahpLog: { ts: wireTs, dir: "c2s" } });
    expect(meta).not.toBeNull();
    expect(meta?.ts).toBe(Date.parse(wireTs));
    expect(meta?.tsRaw).toBe(wireTs);
    expect(meta?.dir).toBe("c2s");
  });

  it("honours s2c direction", () => {
    const meta = extractWireMeta({
      _ahpLog: { ts: "2026-05-11T17:11:14.356Z", dir: "s2c" },
    });
    expect(meta?.dir).toBe("s2c");
  });

  it("returns dir=null when _ahpLog.dir is absent or invalid", () => {
    const wireTs = "2026-05-11T17:11:14.356Z";
    expect(extractWireMeta({ _ahpLog: { ts: wireTs } })?.dir).toBeNull();
    expect(extractWireMeta({ _ahpLog: { ts: wireTs, dir: "unknown" } })?.dir).toBeNull();
    expect(extractWireMeta({ _ahpLog: { ts: wireTs, dir: 42 } })?.dir).toBeNull();
    // Other fields still returned.
    const meta = extractWireMeta({ _ahpLog: { ts: wireTs, dir: "unknown" } });
    expect(meta?.ts).toBe(Date.parse(wireTs));
    expect(meta?.tsRaw).toBe(wireTs);
  });
});
