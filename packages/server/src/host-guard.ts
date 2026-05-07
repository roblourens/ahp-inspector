// Host-header allow-list. Mitigates DNS-rebinding attacks against the local
// loopback server (T-02-04a). Only `127.0.0.1` and `localhost` (with optional
// port) are accepted; anything else returns 421 Misdirected Request.

import type { MiddlewareHandler } from "hono";

const ALLOWED_HOST_RE = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i;

export const hostGuardMiddleware: MiddlewareHandler = async (c, next) => {
  const host = c.req.header("host") ?? "";
  if (!ALLOWED_HOST_RE.test(host)) {
    return c.text("Misdirected request", 421);
  }
  await next();
};
