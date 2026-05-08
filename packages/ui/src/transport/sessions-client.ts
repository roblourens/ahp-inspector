/**
 * sessions-client.ts — browser-only HTTP client for session discovery / open
 * (Plan 04-05 Task 1).
 *
 * Endpoints:
 *   GET  /api/sessions/discover  → 200 { candidates: SafeCandidate[] }
 *   POST /api/sessions/open      → 200 { ok: true } | 4xx { code }
 *
 * Errors thrown to callers carry only the server-supplied `code` string —
 * never the typed path or raw OS error message (T-04-05-01).
 */

import type { SafeCandidate } from "../types/safe-candidate.js";

export class SessionOpenError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SessionOpenError";
  }
}

export async function fetchCandidates(): Promise<readonly SafeCandidate[]> {
  let res: Response;
  try {
    res = await fetch("/api/sessions/discover");
  } catch {
    throw new SessionOpenError("network", "fetch failed");
  }
  if (!res.ok) {
    throw new SessionOpenError("network", `discover ${res.status}`);
  }
  const data = (await res.json()) as { candidates?: SafeCandidate[] };
  return data.candidates ?? [];
}

async function postOpen(body: unknown): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/sessions/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SessionOpenError("network", "fetch failed");
  }
  if (res.ok) return;
  let code = "bad-request";
  try {
    const json = (await res.json()) as { code?: string };
    if (json && typeof json.code === "string") code = json.code;
  } catch {
    /* unparseable body — keep fallback */
  }
  throw new SessionOpenError(code, `open failed ${res.status}`);
}

export const openSessionByCandidate = (candidateId: string): Promise<void> =>
  postOpen({ id: candidateId });

export const openSessionByPath = (path: string): Promise<void> => postOpen({ path });
