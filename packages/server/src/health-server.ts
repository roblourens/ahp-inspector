// Local health server. Bound to 127.0.0.1 ONLY (T-03-01, FOUND-04 / Pitfall 7).
// Hostname is hard-coded — no env / argv input — so a regression that swaps
// in any non-loopback bind surfaces immediately in health-server.test.ts.

import { type ServerType, serve } from "@hono/node-server";
import { Hono } from "hono";

export interface HealthServerOptions {
  /** Port to bind. Pass 0 for an ephemeral port. */
  readonly port: number;
  /** Version string returned by GET /health (typically the CLI pkg version). */
  readonly version: string;
}

export interface HealthServerHandle {
  /** Resolved URL the caller can fetch (always http://127.0.0.1:<port>). */
  readonly url: string;
  /** Actual bound port (relevant when callers pass port:0). */
  readonly port: number;
  /** Underlying Node server — exposed for address() introspection in tests. */
  readonly server: ServerType;
  close(): Promise<void>;
}

const HOSTNAME = "127.0.0.1" as const;

export function startHealthServer(opts: HealthServerOptions): Promise<HealthServerHandle> {
  const app = new Hono();
  app.get("/health", (c) => c.json({ status: "ok", version: opts.version }));

  return new Promise<HealthServerHandle>((resolve, reject) => {
    const server = serve(
      {
        fetch: app.fetch,
        // Hard-coded — DO NOT read from env/argv. Regressions caught by tests.
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
