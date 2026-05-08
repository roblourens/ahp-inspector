#!/usr/bin/env node
// ahp-viewer CLI entrypoint (Phase 2, Plan 02-05).
//
// Validates inputs, builds AppState from the file, starts the log server
// bound to 127.0.0.1, prints UI-SPEC §10 verbatim copy, opens the default
// browser, and cleans up on SIGINT/SIGTERM. Direction inference is
// structural (`classifyDirection`) — Phase-1's hard-coded `dir='c2s'` is
// gone.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeHostAdapter, resolveCandidateId } from "@ahp-viewer/host-node";
import {
  createLogSessionManager,
  type LogServerHandle,
  type LogSessionManager,
  startLogServer,
} from "@ahp-viewer/server";
import { Command } from "commander";
import open from "open";
import { classifyDirection } from "./direction.js";

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

/**
 * Resolve the built UI dist directory (`packages/ui/dist`). Looked up
 * relative to the CLI's location at runtime so it works whether we're
 * launched from `tsx` (src) or the bundled binary (dist). Returns
 * `undefined` if the bundle hasn't been built yet — the server will then
 * skip the static UI mount and the API still works.
 */
function locateUiDist(): string | undefined {
  const cliPackageDir = resolvePath(__dirname, "..");
  const workspacePackagesDir = resolvePath(cliPackageDir, "..");
  const workspaceRootDir = resolvePath(workspacePackagesDir, "..");
  const candidates = Array.from(
    new Set([
      // Workspace sibling: packages/cli/{src,dist} → packages/ui/dist
      resolvePath(workspacePackagesDir, "ui", "dist"),
      // Packaged CLI layout if the UI bundle is embedded with the CLI.
      resolvePath(cliPackageDir, "ui", "dist"),
      // Monorepo root fallback when launched from a relocated package dir.
      resolvePath(workspaceRootDir, "packages", "ui", "dist"),
    ]),
  );
  for (const c of candidates) {
    try {
      if (existsSync(join(c, "index.html"))) return c;
    } catch {
      /* try next */
    }
  }
  process.stderr.write(
    "Warning: UI dist not found — serving API only. Run `pnpm --filter @ahp-viewer/ui build` to build the UI.\n",
  );
  return undefined;
}

function fail(msg: string, code = 1): never {
  process.stderr.write(msg.endsWith("\n") ? msg : `${msg}\n`);
  process.exit(code);
}

function parsePort(value: string): number {
  if (!/^-?\d+$/.test(value)) {
    fail(`Error: invalid --port value: ${value}. Use 0–65535.`);
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    fail(`Error: invalid --port value: ${value}. Use 0–65535.`);
  }
  return n;
}

const program = new Command()
  .name("ahp-viewer")
  .version(VERSION)
  .argument("[file]", "AHP JSONL log file path (optional — omit to launch into the discovery picker)")
  .option("--port <n>", "local server port (0 = ephemeral)", "5173")
  .option("--no-open", "do not auto-open the default browser")
  .action(async (file: string | undefined, opts: { port: string; open: boolean }) => {
    const port = parsePort(opts.port);
    const host = new NodeHostAdapter();
    const sessions: LogSessionManager = createLogSessionManager({
      host,
      resolveCandidateId,
      directionInference: classifyDirection,
    });

    let absPath: string | undefined;
    if (file) {
      absPath = resolvePath(file);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(absPath);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "ENOENT") {
          fail(`Error: log file not found: ${absPath}\nUsage: ahp-viewer [path-to-log.jsonl]`);
        }
        fail(`Error: cannot read ${absPath}: ${e.message}\nCheck file permissions.`);
      }
      if (!stat.isFile()) {
        fail(`Error: log file not found: ${absPath}\nUsage: ahp-viewer [path-to-log.jsonl]`);
      }
      try {
        await sessions.open({ path: absPath });
      } catch (err) {
        const e = err as { code?: string; message?: string };
        await sessions.dispose().catch(() => undefined);
        fail(
          `Error: cannot open ${absPath}: ${e.message ?? "unknown"}\nCheck file permissions.`,
        );
      }
    }

    let serverHandle: LogServerHandle;
    const uiDistDir = locateUiDist();
    try {
      const serverOpts: Parameters<typeof startLogServer>[0] = {
        sessions,
        port,
        version: VERSION,
        ...(uiDistDir ? { uiDistDir } : {}),
      };
      serverHandle = await startLogServer(serverOpts);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      await sessions.dispose().catch(() => undefined);
      if (e.code === "EADDRINUSE") {
        fail(
          `Error: port ${port} is in use. Try: ahp-viewer --port ${port + 1}${file ? ` ${file}` : ""}`,
        );
      }
      fail(`Error: failed to start server: ${e.message}`);
    }

    // URL is constructed from server-controlled host (127.0.0.1, hard-coded
    // in startLogServer) + the bound port. NEVER from user-supplied input.
    // T-02-05b: open() only ever receives this loopback URL.
    const url = `http://127.0.0.1:${serverHandle.port}`;
    if (absPath) {
      process.stdout.write(
        `AHP Log Viewer running at ${url}\nOpening browser…\nWatching ${absPath}\n`,
      );
    } else {
      process.stdout.write(
        `AHP Log Viewer running at ${url}\nOpening browser…\n(No log file selected — use the picker to discover or open a log.)\n`,
      );
    }

    if (opts.open !== false) {
      try {
        await open(url, { wait: false });
      } catch {
        process.stdout.write(`(could not auto-open; visit ${url})\n`);
      }
    }

    let shuttingDown = false;
    const shutdown = async (): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;
      try {
        await sessions.dispose();
      } catch {
        // ignore — best-effort
      }
      try {
        await serverHandle.close();
      } catch {
        // ignore — best-effort
      }
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
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
});
