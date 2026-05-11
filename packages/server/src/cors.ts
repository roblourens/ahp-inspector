// Loopback-only CORS. The hostGuardMiddleware (mounted before this) guarantees
// the request arrived on a 127.0.0.1/localhost Host header, so echoing the
// Origin back is safe. We never set credentials.
//
// Rationale: the VS Code webview's origin is something like
// `vscode-webview://<random-guid>` — opaque, varies per panel. Echoing the
// Origin (when present) lets that webview hit /api/*, while same-origin
// browser standalone use is unaffected (browsers skip preflight on same-origin).

import type { MiddlewareHandler } from "hono";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
	const origin = c.req.header("origin");
	if (c.req.method === "OPTIONS") {
		const reqHeaders = c.req.header("access-control-request-headers") ?? "*";
		const reqMethod = c.req.header("access-control-request-method") ?? "GET";
		return new Response(null, {
			status: 204,
			headers: {
				"access-control-allow-origin": origin ?? "*",
				"access-control-allow-methods": `${reqMethod}, GET, POST, OPTIONS`,
				"access-control-allow-headers": reqHeaders,
				"access-control-max-age": "600",
				vary: "Origin",
			},
		});
	}
	await next();
	if (origin) {
		c.res.headers.set("access-control-allow-origin", origin);
		c.res.headers.append("vary", "Origin");
	}
};
