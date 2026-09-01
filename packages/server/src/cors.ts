// Loopback-only CORS with a strict Origin allow-list (see origin.ts).
//
// The hostGuardMiddleware (mounted before this) guarantees the request arrived
// on a 127.0.0.1/localhost Host header, but that does NOT stop a remote web
// page from *sending* requests to http://127.0.0.1:<port>. So we:
//   1. only grant CORS read access (ACAO) to allowed origins, and
//   2. reject every request that carries a disallowed Origin.
// Same-origin standalone use and non-browser clients send no Origin and are
// unaffected. We never set credentials.

import type { MiddlewareHandler } from "hono";
import { hasValidApiToken } from "./api-auth.js";
import { isAllowedOrigin } from "./origin.js";

export function createCorsMiddleware(apiToken: string): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header("origin");
    const allowed =
      isAllowedOrigin(origin, hasValidApiToken(c.req.url, apiToken)) &&
      isSameLoopbackOrigin(origin, c.req.url);

    if (!allowed) {
      return c.json({ code: "forbidden-origin", message: "forbidden-origin" }, 403);
    }

    if (c.req.method === "OPTIONS") {
      const reqHeaders = c.req.header("access-control-request-headers") ?? "*";
      const reqMethod = c.req.header("access-control-request-method") ?? "GET";
      const headers: Record<string, string> = {
        "access-control-allow-methods": `${reqMethod}, GET, POST, OPTIONS`,
        "access-control-allow-headers": reqHeaders,
        "access-control-max-age": "600",
        vary: "Origin",
      };
      if (origin !== undefined) headers["access-control-allow-origin"] = origin;
      return new Response(null, { status: 204, headers });
    }

    await next();
    if (origin !== undefined) {
      c.res.headers.set("access-control-allow-origin", origin);
      c.res.headers.append("vary", "Origin");
    }
  };
}

export const corsMiddleware = createCorsMiddleware("");

function isSameLoopbackOrigin(origin: string | undefined, requestUrl: string): boolean {
  if (origin === undefined || !origin.startsWith("http")) return true;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
