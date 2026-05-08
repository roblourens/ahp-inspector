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

export interface ActiveLogMeta {
  readonly filename: string;
  readonly sizeBytes: number;
  readonly startedAt: number;
  readonly logKey: string;
}

export interface OpenSessionResult {
  readonly active: {
    readonly logKey: string;
    readonly meta: ActiveLogMeta;
  };
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOpenResult(value: unknown): OpenSessionResult {
  if (!isRecord(value) || !isRecord(value.active)) {
    throw new SessionOpenError("bad-response", "open response missing active session");
  }
  const { active } = value;
  if (typeof active.logKey !== "string" || !isRecord(active.meta)) {
    throw new SessionOpenError("bad-response", "open response missing log key");
  }
  const { meta } = active;
  if (
    typeof meta.filename !== "string" ||
    typeof meta.sizeBytes !== "number" ||
    typeof meta.startedAt !== "number" ||
    typeof meta.logKey !== "string"
  ) {
    throw new SessionOpenError("bad-response", "open response missing metadata");
  }
  return {
    active: {
      logKey: active.logKey,
      meta: {
        filename: meta.filename,
        sizeBytes: meta.sizeBytes,
        startedAt: meta.startedAt,
        logKey: meta.logKey,
      },
    },
  };
}

async function postOpen(body: unknown): Promise<OpenSessionResult> {
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
  if (res.ok) {
    try {
      return parseOpenResult(await res.json());
    } catch (err) {
      if (err instanceof SessionOpenError) throw err;
      throw new SessionOpenError("bad-response", "open response was not JSON");
    }
  }
  let code = "bad-request";
  try {
    const json = (await res.json()) as { code?: string };
    if (json && typeof json.code === "string") code = json.code;
  } catch {
    /* unparseable body — keep fallback */
  }
  throw new SessionOpenError(code, `open failed ${res.status}`);
}

export const openSessionByCandidate = (candidateId: string): Promise<OpenSessionResult> =>
  postOpen({ id: candidateId });

export const openSessionByPath = (path: string): Promise<OpenSessionResult> => postOpen({ path });
