// session-manager.test.ts — Phase 04-03 Task 1.
// Verifies the LogSessionManager lifecycle, error mapping, and stable logKey.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeHostAdapter } from "@ahp-viewer/host-node";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogSessionManager } from "./session-manager.js";

let dir: string;
let pathA: string;
let pathB: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "ahp-sess-"));
  pathA = join(dir, "a.jsonl");
  pathB = join(dir, "b.jsonl");
  await writeFile(pathA, '{"a":1}\n');
  await writeFile(pathB, '{"b":2}\n');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const noResolve = (_id: string): string | null => null;

describe("LogSessionManager", () => {
  it("starts with current() === null", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    expect(m.current()).toBeNull();
    await m.dispose();
  });

  it("open({path}) returns ActiveSession with stable logKey", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    const s = await m.open({ path: pathA });
    expect(s.logKey).toMatch(/^[0-9a-f]{32}$/);
    expect(m.current()?.logKey).toBe(s.logKey);
    // Re-opening same file with same mtime → same key.
    const s2 = await m.open({ path: pathA });
    expect(s2.logKey).toBe(s.logKey);
    await m.dispose();
  });

  it("open({path}) → switching disposes previous and notifies onChange", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    const events: Array<{ logKey: string } | null> = [];
    m.onChange((a) => events.push(a ? { logKey: a.logKey } : null));
    const a1 = await m.open({ path: pathA });
    const a2 = await m.open({ path: pathB });
    expect(a1.logKey).not.toBe(a2.logKey);
    // 2 onChange events: open A, switch to B (B's open also calls notify).
    expect(events.filter((e) => e !== null).length).toBe(2);
    await m.dispose();
  });

  it("close() disposes current and emits null", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    const seen: Array<unknown> = [];
    m.onChange((a) => seen.push(a));
    await m.open({ path: pathA });
    await m.close();
    expect(m.current()).toBeNull();
    expect(seen.at(-1)).toBeNull();
    await m.dispose();
  });

  it("open({id}) resolves via resolveCandidateId", async () => {
    const idMap = new Map([["abc123", pathA]]);
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: (id) => idMap.get(id) ?? null,
    });
    const s = await m.open({ id: "abc123" });
    expect(s.appState.meta.filename).toBe("a.jsonl");
    await m.dispose();
  });

  it("open({id}) with unknown id rejects with code:not-found", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    await expect(m.open({ id: "missing" })).rejects.toMatchObject({ code: "not-found" });
    await m.dispose();
  });

  it("open({path}) with path > 4096 chars rejects with code:path-too-long", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    const longPath = `/${"a".repeat(5000)}`;
    await expect(m.open({ path: longPath })).rejects.toMatchObject({ code: "path-too-long" });
    await m.dispose();
  });

  it("open({path}) for missing file rejects with code:not-found", async () => {
    const m = createLogSessionManager({
      host: new NodeHostAdapter(),
      resolveCandidateId: noResolve,
    });
    await expect(m.open({ path: join(dir, "ghost.jsonl") })).rejects.toMatchObject({
      code: "not-found",
    });
    await m.dispose();
  });
});
