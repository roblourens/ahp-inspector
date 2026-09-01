// Local log server. Bound to 127.0.0.1 ONLY — same hard-coded HOSTNAME
// pattern as health-server.ts (FOUND-04, T-02-04c).
//
// Composes:
//   - hostGuardMiddleware  → reject non-loopback Host: headers (T-02-04a)
//   - cspMiddleware        → CSP + nosniff + no-referrer (T-02-04b)
//   - GET /health          → liveness probe
//   - registerLogRoutes    → /api/log/meta + /api/log/stream
//   - registerSessionRoutes → /api/sessions/{discover,open,close,active}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type ServerType, serve } from "@hono/node-server";
import { Hono } from "hono";
import { createApiAuthMiddleware, createApiToken } from "./api-auth.js";
import { createCorsMiddleware } from "./cors.js";
import { cspMiddleware } from "./csp.js";
import { registerDetailRoutes } from "./detail-routes.js";
import { hostGuardMiddleware } from "./host-guard.js";
import { registerSearchRoutes } from "./search-routes.js";
import type { LogSessionManager } from "./session-manager.js";
import { registerSessionRoutes } from "./session-routes.js";
import { registerLogRoutes } from "./sse-routes.js";
import { registerStateRoutes } from "./state-routes.js";
import { registerStaticUi } from "./static-ui.js";
import { registerUploadRoutes } from "./upload-routes.js";

const HOSTNAME = "127.0.0.1" as const;

export interface LogServerOptions {
  readonly sessions: LogSessionManager;
  /** Bind port. Pass 0 for an ephemeral port. */
  readonly port: number;
  /** Version string returned by GET /health. */
  readonly version: string;
  /**
   * Optional absolute path to the built UI dist directory. When set, the
   * server mounts `/`, `/assets/*`, `/fonts/*` to serve the standalone web
   * app. Plan 02-06.
   */
  readonly uiDistDir?: string;
}

export interface LogServerHandle {
  readonly url: string;
  readonly port: number;
  readonly apiToken: string;
  readonly server: ServerType;
  close(): Promise<void>;
}

export function startLogServer(opts: LogServerOptions): Promise<LogServerHandle> {
  const { sessions } = opts;
  const apiToken = createApiToken();
  const app = new Hono();
  app.use("*", hostGuardMiddleware);
  app.use("*", cspMiddleware);
  app.use("/api/*", createApiAuthMiddleware(apiToken));
  app.use("*", createCorsMiddleware(apiToken));
  app.get("/health", (c) => c.json({ status: "ok", version: opts.version }));
  registerLogRoutes(app, sessions);
  registerDetailRoutes(app, sessions);
  registerSearchRoutes(app, sessions);
  registerStateRoutes(app, sessions);
  registerSessionRoutes(app, sessions);
  const uploadRoutes = registerUploadRoutes(app, sessions);
  if (opts.uiDistDir) {
    const indexPath = join(opts.uiDistDir, "index.html");
    app.get("/", async (c) => {
      let html: string;
      try {
        html = await readFile(indexPath, "utf8");
      } catch {
        return c.text("Not found", 404);
      }
      const headEnd = html.indexOf("</head>");
      if (headEnd < 0) return c.text("Invalid UI bundle", 500);
      const tokenMeta = `<meta name="ahp-api-token" content="${apiToken}" />`;
      c.header("Cache-Control", "no-store");
      return c.html(`${html.slice(0, headEnd)}${tokenMeta}${html.slice(headEnd)}`);
    });
    registerStaticUi(app, opts.uiDistDir);
  }

  return new Promise<LogServerHandle>((resolve, reject) => {
    let listening = false;
    const server = serve(
      {
        fetch: app.fetch,
        // Hard-coded — DO NOT read from env/argv. Regression caught by tests.
        hostname: HOSTNAME,
        port: opts.port,
      },
      (info) => {
        listening = true;
        const port = info.port;
        let closePromise: Promise<void> | null = null;
        resolve({
          url: `http://${HOSTNAME}:${port}`,
          port,
          apiToken,
          server,
          close: () => {
            closePromise ??= (async () => {
              const errors: unknown[] = [];
              try {
                await new Promise<void>((res, rej) => {
                  server.close((err) => (err ? rej(err) : res()));
                  if (
                    "closeAllConnections" in server &&
                    typeof server.closeAllConnections === "function"
                  ) {
                    server.closeAllConnections();
                  }
                });
              } catch (error) {
                errors.push(error);
              }
              try {
                await uploadRoutes.dispose();
              } catch (error) {
                errors.push(error);
              }
              server.removeListener("error", onError);
              if (errors.length === 1) throw errors[0];
              if (errors.length > 1) {
                throw new AggregateError(errors, "Failed to close log server");
              }
            })();
            return closePromise;
          },
        });
      },
    );
    const onError = (error: Error): void => {
      if (listening) return;
      server.removeListener("error", onError);
      void uploadRoutes.dispose().then(
        () => reject(error),
        (cleanupError: unknown) =>
          reject(new AggregateError([error, cleanupError], "Failed to start log server")),
      );
    };
    server.on("error", onError);
  });
}
