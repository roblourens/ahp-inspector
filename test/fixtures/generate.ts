// Synthesizes all Phase 1 Wave 0 fixtures from in-memory canonical shapes.
// Never reads ~/agenthost.*.log or any real capture. Idempotent.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// --- Canonical synthetic JSON-RPC envelopes (8 lines, one per EventKind variant) ---
// All ids/payloads are placeholders. No tokens, no PII, no secrets.
const tinyLines: string[] = [
  // 1: c2s request
  '{"jsonrpc":"2.0","id":1,"method":"listSessions","params":{}}',
  // 2: s2c response (success)
  '{"jsonrpc":"2.0","id":1,"result":{"sessions":[]}}',
  // 3: c2s notification
  '{"jsonrpc":"2.0","method":"dispatch","params":{"action":{"type":"noop"}}}',
  // 4: s2c action notification
  '{"jsonrpc":"2.0","method":"action","params":{"action":{"type":"rootState.onDidChange","payload":{}},"serverSeq":1,"origin":"server"}}',
  // 5: s2c protocol notification
  '{"jsonrpc":"2.0","method":"notification","params":{"notification":{"type":"log","message":"hello"}}}',
  // 6: s2c response (error)
  '{"jsonrpc":"2.0","id":2,"error":{"code":-32000,"message":"boom"}}',
  // 7: c2s request with string id
  '{"jsonrpc":"2.0","id":"abc","method":"authenticate","params":{}}',
  // 8: c2s request with null id
  '{"jsonrpc":"2.0","id":null,"method":"ping","params":{}}',
];

const malformedLines: string[] = [
  tinyLines[0]!,
  '{"jsonrpc":"2.0","id":3,"method":"listSes',
  "this is not json",
  "",
  tinyLines[1]!,
];

// 3 valid lines for the BOM fixture
const bomBody = [tinyLines[0]!, tinyLines[1]!, tinyLines[2]!].join("\n");

const legacyBlocks =
  "[2026-01-01T00:00:00.000Z] >> listSessions\n" +
  '  {"jsonrpc":"2.0","id":1,"method":"listSessions","params":{}}\n' +
  "[2026-01-01T00:00:00.010Z] << listSessions\n" +
  '  {"jsonrpc":"2.0","id":1,"result":{"sessions":[]}}\n' +
  "[2026-01-01T00:00:00.020Z] >> dispatch\n" +
  '  {"jsonrpc":"2.0","method":"dispatch","params":{"action":{"type":"noop"}}}\n' +
  "[2026-01-01T00:00:00.030Z] ** rootState.onDidChange\n" +
  '  {"jsonrpc":"2.0","method":"action","params":{"action":{"type":"rootState.onDidChange","payload":{}},"serverSeq":1,"origin":"server"}}\n' +
  "[2026-01-01T00:00:00.040Z] ** onDidNotification\n" +
  '  {"jsonrpc":"2.0","method":"notification","params":{"notification":{"type":"log","message":"hi"}}}\n' +
  "[2026-01-01T00:00:00.050Z] !! authenticate\n" +
  '  {"jsonrpc":"2.0","id":2,"error":{"code":-32000,"message":"unauthorized"}}\n';

export interface GeneratedFixtures {
  tiny: string;
  malformed: string;
  crlf: string;
  bom: string;
  legacy: string;
}

export function buildFixtures(): GeneratedFixtures {
  return {
    tiny: `${tinyLines.join("\n")}\n`,
    malformed: `${malformedLines.join("\n")}\n`,
    crlf: `${tinyLines.join("\r\n")}\r\n`,
    bom: `\uFEFF${bomBody}\n`,
    legacy: legacyBlocks,
  };
}

export function generateAll(outDir = "test/fixtures"): GeneratedFixtures {
  const fixtures = buildFixtures();
  const root = resolve(outDir);
  mkdirSync(root, { recursive: true });
  const writes: Array<[string, string]> = [
    ["tiny.jsonl", fixtures.tiny],
    ["malformed.jsonl", fixtures.malformed],
    ["crlf.jsonl", fixtures.crlf],
    ["bom.jsonl", fixtures.bom],
    ["legacy.sample.log", fixtures.legacy],
  ];
  for (const [name, body] of writes) {
    const target = resolve(root, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body, { encoding: "utf8" });
  }
  return fixtures;
}
