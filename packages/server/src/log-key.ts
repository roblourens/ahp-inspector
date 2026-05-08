import { createHash } from "node:crypto";

/**
 * Stable, non-reversible identifier for an opened log. Implements D-16:
 * sha256(absPath + "\0" + initialMtimeMs), truncated to 128 bits (32 hex).
 *
 * Important: pass the mtime captured at open time, NOT the current size — the
 * key must remain stable as the log grows so per-log persistence keeps working
 * across appends.
 */
export function computeLogKey(absPath: string, initialMtimeMs: number): string {
  const h = createHash("sha256");
  h.update(absPath);
  h.update("\u0000");
  h.update(String(Math.floor(initialMtimeMs)));
  return h.digest("hex").slice(0, 32);
}
