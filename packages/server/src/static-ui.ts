// Static UI middleware (Plan 02-06). Mounts the built UI bundle from
// `packages/ui/dist/` at `/`. CSP, X-Content-Type-Options, and Referrer-Policy
// are applied by `cspMiddleware` registered earlier on the same Hono app —
// static responses inherit those headers automatically (T-02-06-03).
//
// `serveStatic` rejects `..` traversal by regex (T-02-06-04). All paths are
// rooted at the absolute distDir so cwd changes do not affect resolution.

import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

export interface StaticUiOptions {
  /** Absolute path to the built UI dist directory (must contain index.html). */
  readonly distDir: string;
}

export function registerStaticUi(app: Hono, distDir: string): void {
  // Bundled assets (JS/CSS hashed by Vite) live under /assets/*.
  app.use("/assets/*", serveStatic({ root: distDir }));
  // Self-hosted fonts live under /fonts/* (local-only privacy posture).
  app.use("/fonts/*", serveStatic({ root: distDir }));
  // Favicon/static root files.
  app.use("/favicon.ico", serveStatic({ path: `${distDir}/favicon.ico` }));
  // Index HTML at /.
  app.get("/", serveStatic({ path: `${distDir}/index.html` }));
}
