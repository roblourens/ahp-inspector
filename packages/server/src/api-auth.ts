import { randomBytes, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export const API_TOKEN_QUERY_PARAM = "_ahpToken";

export function createApiToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hasValidApiToken(requestUrl: string, expectedToken: string): boolean {
  if (expectedToken.length === 0) return false;
  const suppliedTokens = new URL(requestUrl).searchParams.getAll(API_TOKEN_QUERY_PARAM);
  if (suppliedTokens.length !== 1) return false;

  const supplied = Buffer.from(suppliedTokens[0] ?? "", "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createApiAuthMiddleware(apiToken: string): MiddlewareHandler {
  return async (c, next) => {
    if (!hasValidApiToken(c.req.url, apiToken)) {
      return c.json({ code: "forbidden", message: "forbidden" }, 403);
    }
    await next();
  };
}
