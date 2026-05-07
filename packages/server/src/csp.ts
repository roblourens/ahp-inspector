// CSP middleware. Locked policy for the local viewer's loopback HTTP server:
// no inline scripts, no third-party origins, no framing.
//
// 02-RESEARCH.md Pattern 4 (CSP), Security Domain. Threat T-02-04b.
// Style 'unsafe-inline' is required because the UI's design tokens are
// surfaced via inline <style> for theme switching; scripts remain locked.

import type { MiddlewareHandler } from "hono";

export const CSP_VALUE =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'none'; " +
  "frame-ancestors 'none'";

export const cspMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Content-Security-Policy", CSP_VALUE);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
};
