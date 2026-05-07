// Local log server. Bound to 127.0.0.1 ONLY — same hard-coded HOSTNAME
// pattern as health-server.ts (FOUND-04, T-02-04c).
//
// Composes:
//   - hostGuardMiddleware  → reject non-loopback Host: headers (T-02-04a)
//   - cspMiddleware        → CSP + nosniff + no-referrer (T-02-04b)
//   - GET /health          → liveness probe
//   - registerLogRoutes    → /api/log/meta + /api/log/stream

import { type ServerType, serve } from "@hono/node-server";
import { Hono } from "hono";
import type { AppState } from "./app-state.js";
import { cspMiddleware } from "./csp.js";
import { registerDetailRoutes } from "./detail-routes.js";
import { hostGuardMiddleware } from "./host-guard.js";
import { registerSearchRoutes } from "./search-routes.js";
import { registerLogRoutes } from "./sse-routes.js";
import { registerStaticUi } from "./static-ui.js";

const HOSTNAME = "127.0.0.1" as const;

export interface LogServerOptions {
  readonly appState: AppState;
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
  readonly server: ServerType;
  close(): Promise<void>;
}

export function startLogServer(opts: LogServerOptions): Promise<LogServerHandle> {
  const app = new Hono();
  app.use("*", hostGuardMiddleware);
  app.use("*", cspMiddleware);
  app.get("/health", (c) => c.json({ status: "ok", version: opts.version }));
  registerLogRoutes(app, opts.appState);
  registerDetailRoutes(app, opts.appState);
  registerSearchRoutes(app, opts.appState);
  if (opts.uiDistDir) registerStaticUi(app, opts.uiDistDir);

  return new Promise<LogServerHandle>((resolve, reject) => {
    const server = serve(
      {
        fetch: app.fetch,
        // Hard-coded — DO NOT read from env/argv. Regression caught by tests.
        hostname: HOSTNAME,
        port: opts.port,
      },
      (info) => {
        const port = info.port;
        resolve({
          url: `http://${HOSTNAME}:${port}`,
          port,
          server,
          close: () =>
            new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
        });
      },
    );
    server.on("error", reject);
  });
}
