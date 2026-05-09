import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLegacyBlock, parseLegacyStream } from "./legacy.js";

// ─── Round-trip: synthesised legacy fixture ──────────────────────────────────

describe("legacy adapter (INGEST-07)", () => {
  const text = readFileSync(resolve("test/fixtures/legacy.sample.log"), "utf8");
  const events = parseLegacyStream(text);

  it("yields exactly 6 canonical events", () => {
    expect(events).toHaveLength(6);
  });

  it("classifies the synthesised blocks per RESEARCH §Legacy adapter sketch", () => {
    expect(events[0]?.kind).toBe("request");
    expect(events[0]?.method).toBe("listSessions");
    expect(events[0]?.id).toBe(1);

    expect(events[1]?.kind).toBe("response");
    expect(events[1]?.id).toBe(1);

    expect(events[2]?.kind).toBe("client-notification");
    expect(events[2]?.method).toBe("dispatch");

    expect(events[3]?.kind).toBe("action");
    expect(events[3]?.actionType).toBe("rootState.onDidChange");
    expect(events[3]?.serverSeq).toBe(1);

    expect(events[4]?.kind).toBe("protocol-notification");
    expect(events[4]?.actionType).toBe("log");

    expect(events[5]?.kind).toBe("response");
    expect(events[5]?.id).toBe(2);
  });

  it("preserves tsRaw on every event", () => {
    expect(events.every((e) => typeof e.tsRaw === "string" && e.tsRaw.length > 0)).toBe(true);
  });

  it("unrecognised header line yields a parse-error event", () => {
    const ev = parseLegacyBlock("garbage line", "{}", { seq: 0, byteOffset: 0, byteLength: 0 });
    expect(ev.kind).toBe("parse-error");
    expect(ev.parseError?.reason).toBe("unrecognised header");
  });
});

// ─── Isolation invariants (Pitfall 6) ────────────────────────────────────────

describe("legacy adapter isolation", () => {
  it("legacy.ts exports exactly two named symbols", () => {
    const src = readFileSync(resolve("packages/parser/src/legacy.ts"), "utf8");
    const exports = src.match(/^export\s+(?:function|const|class)\s+(\w+)/gm) ?? [];
    const names = exports.map((line) => line.replace(/^export\s+(?:function|const|class)\s+/, ""));
    expect(names.sort()).toEqual(["parseLegacyBlock", "parseLegacyStream"]);
  });

  it("legacy.ts contains no escape-hatch helpers (isDispatch / getOriginalMarker)", () => {
    const src = readFileSync(resolve("packages/parser/src/legacy.ts"), "utf8");
    expect(/isDispatch|getOriginalMarker/.test(src)).toBe(false);
  });

  it("no non-parser package imports legacy", () => {
    const PROBE =
      /from\s+["'](?:@ahp-inspector\/parser\/legacy|[^"']*parser\/src\/legacy|\.\/legacy|\.\.\/legacy)["']/;
    const offenders: string[] = [];
    for (const pkg of ["shared", "core", "host-node", "server", "cli"]) {
      const root = resolve("packages", pkg, "src");
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(root);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      walk(root, (file) => {
        const body = readFileSync(file, "utf8");
        if (PROBE.test(body)) offenders.push(file);
      });
    }
    expect(offenders, `legacy import leak: ${offenders.join(", ")}`).toEqual([]);
  });
});

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(full, visit);
    else if (entry.isFile() && entry.name.endsWith(".ts")) visit(full);
  }
}
