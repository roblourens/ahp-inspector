#!/usr/bin/env node
// ahp-inspector CLI entrypoint (Phase 2, Plan 02-05).
//
// Validates inputs, builds AppState from the file, starts the log server
// bound to 127.0.0.1, prints UI-SPEC §10 verbatim copy, opens the default
// browser, and cleans up on SIGINT/SIGTERM. Direction inference is
// structural (`classifyDirection`) — Phase-1's hard-coded `dir='c2s'` is
// gone.
//
// Phase 13: when invoked with no path argument, auto-discovers the most
// recent AHP-shape JSONL log under the standard VS Code log roots and
// opens it. If none qualify, falls back to the discovery picker UI.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { findLatestAhpLog, NodeHostAdapter, resolveCandidateId } from "@ahp-inspector/host-node";
import {
  createLogSessionManager,
  type LogServerHandle,
  type LogSessionManager,
  startLogServer,
} from "@ahp-inspector/server";
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
      // Packaged tarball: ahp-inspector/ui-dist/ (postbuild copy)
      resolvePath(cliPackageDir, "ui-dist"),
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
    "Warning: UI dist not found — serving API only. Run `pnpm --filter @ahp-inspector/ui build` to build the UI.\n",
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
  .name("ahp-inspector")
  .version(VERSION)
  .argument(
    "[file]",
    "AHP JSONL log file path (optional — omit to launch into the discovery picker)",
  )
  .option("--port <n>", "local server port (0 = ephemeral)", "5173")
  .option("--no-open", "do not auto-open the default browser")
  .option(
    "--no-auto-discover",
    "do not auto-open the latest AHP log when no path argument is provided",
  )
  .action(
    async (
      file: string | undefined,
      opts: { port: string; open: boolean; autoDiscover: boolean },
    ) => {
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
            fail(`Error: log file not found: ${absPath}\nUsage: ahp-inspector [path-to-log.jsonl]`);
          }
          fail(`Error: cannot read ${absPath}: ${e.message}\nCheck file permissions.`);
        }
        if (!stat.isFile()) {
          fail(`Error: log file not found: ${absPath}\nUsage: ahp-inspector [path-to-log.jsonl]`);
        }
        try {
          await sessions.open({ path: absPath });
        } catch (err) {
          const e = err as { code?: string; message?: string };
          try {
            await sessions.dispose();
          } catch {
            process.stderr.write("Error: failed to clean up session resources.\n");
          }
          fail(`Error: cannot open ${absPath}: ${e.message ?? "unknown"}\nCheck file permissions.`);
        }
      } else {
        // No path argument — try to auto-open the newest AHP-shape log under the
        // standard VS Code log roots (Phase 13, CONTEXT D-3). If none qualify,
        // fall back to the discovery picker UI without erroring.
        const autoDiscoverEnabled = opts.autoDiscover !== false;
        const auto = autoDiscoverEnabled ? await findLatestAhpLog() : null;
        if (auto) {
          absPath = auto;
          try {
            await sessions.open({ path: absPath });
          } catch (err) {
            const e = err as { code?: string; message?: string };
            try {
              await sessions.dispose();
            } catch {
              process.stderr.write("Error: failed to clean up session resources.\n");
            }
            fail(
              `Error: cannot open ${absPath}: ${e.message ?? "unknown"}\nCheck file permissions.`,
            );
          }
        } else if (autoDiscoverEnabled) {
          process.stderr.write("No AHP logs found under VS Code log roots — opened picker UI.\n");
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
        try {
          await sessions.dispose();
        } catch {
          process.stderr.write("Error: failed to clean up session resources.\n");
        }
        if (e.code === "EADDRINUSE") {
          fail(
            `Error: port ${port} is in use. Try: ahp-inspector --port ${port + 1}${file ? ` ${file}` : ""}`,
          );
        }
        fail(`Error: failed to start server: ${e.message}`);
      }

      // URL is constructed from server-controlled host (127.0.0.1, hard-coded
      // in startLogServer) + the bound port. NEVER from user-supplied input.
      // T-02-05b: open() only ever receives this loopback URL.
      const url = `http://127.0.0.1:${serverHandle.port}`;
      let shuttingDown = false;
      const shutdown = async (): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        process.exitCode = 0;
        process.removeListener("SIGINT", requestShutdown);
        process.removeListener("SIGTERM", requestShutdown);
        const errors: unknown[] = [];
        try {
          await serverHandle.close();
        } catch (error) {
          errors.push(error);
        }
        try {
          await sessions.dispose();
        } catch (error) {
          errors.push(error);
        }
        if (errors.length > 0) {
          throw new AggregateError(errors, "Failed to shut down AHP Inspector cleanly");
        }
        process.exit(0);
      };
      const requestShutdown = (): void => {
        void shutdown().catch((error: unknown) => {
          process.stderr.write(`Error: ${(error as Error).message}\n`);
          process.exit(1);
        });
      };
      process.on("SIGINT", requestShutdown);
      process.on("SIGTERM", requestShutdown);

      if (absPath) {
        process.stdout.write(
          `AHP Inspector running at ${url}\nOpening browser…\nWatching ${absPath}\n`,
        );
      } else {
        process.stdout.write(`AHP Inspector running at ${url}\nOpening browser…\n`);
      }

      if (opts.open !== false) {
        try {
          await open(url, { wait: false });
        } catch {
          process.stdout.write(`(could not auto-open; visit ${url})\n`);
        }
      }
    },
  );

program.parseAsync().catch((err) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exit(1);
});
