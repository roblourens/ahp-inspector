// Loopback-only CORS with a strict Origin allow-list (see origin.ts).
//
// The hostGuardMiddleware (mounted before this) guarantees the request arrived
// on a 127.0.0.1/localhost Host header, but that does NOT stop a remote web
// page from *sending* requests to http://127.0.0.1:<port>. So we:
//   1. only grant CORS read access (ACAO) to allowed origins, and
//   2. reject state-changing methods that carry a disallowed Origin.
// Same-origin standalone use and non-browser clients send no Origin and are
// unaffected. We never set credentials.

import type { MiddlewareHandler } from "hono";
import { isAllowedOrigin } from "./origin.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
	const origin = c.req.header("origin");
	const allowed = isAllowedOrigin(origin);

	if (c.req.method === "OPTIONS") {
		const reqHeaders = c.req.header("access-control-request-headers") ?? "*";
		const reqMethod = c.req.header("access-control-request-method") ?? "GET";
		const headers: Record<string, string> = {
			"access-control-allow-methods": `${reqMethod}, GET, POST, OPTIONS`,
			"access-control-allow-headers": reqHeaders,
			"access-control-max-age": "600",
			vary: "Origin",
		};
		// Only advertise CORS access to allowed origins; a disallowed preflight
		// gets a 204 with no ACAO, so the browser blocks the real request.
		if (allowed) headers["access-control-allow-origin"] = origin ?? "*";
		return new Response(null, { status: 204, headers });
	}

	// Reject state-changing requests carrying a disallowed Origin. (Same-origin
	// and non-browser callers send no Origin; cross-origin reads are already
	// blocked by withholding ACAO below.)
	if (origin !== undefined && !allowed && MUTATING_METHODS.has(c.req.method)) {
		return c.json({ code: "forbidden-origin", message: "forbidden-origin" }, 403);
	}

	await next();
	if (allowed && origin !== undefined) {
		c.res.headers.set("access-control-allow-origin", origin);
		c.res.headers.append("vary", "Origin");
	}
};
