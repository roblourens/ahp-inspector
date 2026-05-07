#!/usr/bin/env node
// ahp-viewer CLI entrypoint. Boots the local app shell:
//   - opens a JSONL log via NodeHostAdapter (FOUND-01)
//   - feeds bytes through LineSplitter → parseLine → normalize → EventStore
//   - Correlator pairs requests/responses (EVENT-03)
//   - Hono health server bound to 127.0.0.1 (FOUND-04)
// SIGINT triggers a clean shutdown.

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Correlator, EventStore } from "@ahp-viewer/core";
import { NodeHostAdapter } from "@ahp-viewer/host-node";
import { LineSplitter, normalize, parseLine } from "@ahp-viewer/parser";
import { type HealthServerHandle, startHealthServer } from "@ahp-viewer/server";
import { type Direction, makeParseErrorEvent } from "@ahp-viewer/shared";
import { Command } from "commander";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadVersion(): string {
  const candidates = [join(__dirname, "..", "package.json"), join(__dirname, "package.json")];
  for (const p of candidates) {
    try {
      return (JSON.parse(readFileSync(p, "utf8")) as { version?: string }).version ?? "0.0.0";
    } catch {
      // try next
    }
  }
  return "0.0.0";
}

const VERSION = loadVersion();

const program = new Command()
  .name("ahp-viewer")
  .version(VERSION)
  .argument("[file]", "AHP JSONL log file path")
  .option("--port <n>", "local server port", "5173")
  .option("--no-server", "skip starting the local health server (smoke-test mode)")
  .action(async (file: string | undefined, opts: { port: string; server: boolean }) => {
    const host = new NodeHostAdapter();
    const store = new EventStore();
    void new Correlator(store);

    let serverHandle: HealthServerHandle | undefined;
    if (opts.server !== false) {
      serverHandle = await startHealthServer({
        port: Number(opts.port),
        version: VERSION,
      });
      console.log(`[ahp-viewer] listening on ${serverHandle.url}`);
    }

    let watcherDispose: (() => void) | undefined;
    if (file) {
      const handle = await host.openLog(file);
      console.log(`[ahp-viewer] opened ${handle.path} (${handle.size} bytes)`);
      const splitter = new LineSplitter();
      const decoder = new TextDecoder("utf-8");
      let seq = 0;
      let byteOffset = 0;
      // Phase-1 placeholder: real direction inference lands with the
      // transport in Phase 2.
      const dir: Direction = "c2s";
      const watcher = host.watchLog(handle, (chunk) => {
        const text = decoder.decode(chunk, { stream: true });
        for (const line of splitter.push(text)) {
          const byteLength = Buffer.byteLength(line, "utf8");
          const ts = Date.now();
          const meta = {
            seq,
            ts,
            tsRaw: String(ts),
            dir,
            byteOffset,
            byteLength,
          };
          const parsed = parseLine(line, byteOffset, byteLength);
          const ev = parsed.error
            ? makeParseErrorEvent(meta, parsed.error.reason, parsed.text)
            : normalize(parsed.raw, meta);
          store.append(ev);
          seq += 1;
          byteOffset += byteLength + 1;
        }
      });
      watcherDispose = () => {
        watcher.dispose();
      };
    } else {
      console.log("[ahp-viewer] no file specified; UI not yet wired (Phase 2)");
    }

    const shutdown = async () => {
      if (watcherDispose) watcherDispose();
      if (serverHandle) await serverHandle.close();
      process.exit(0);
    };
    process.on("SIGINT", () => {
      void shutdown();
    });
    process.on("SIGTERM", () => {
      void shutdown();
    });
  });

program.parseAsync().catch((err) => {
  console.error("[ahp-viewer] fatal:", (err as Error)?.message ?? err);
  process.exit(1);
});
