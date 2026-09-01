/**
 * Browser HTTP/SSE implementation of `AhpViewerClient` (Plan 11-02 Task 2).
 *
 * Composes the existing transport modules without changing their public
 * shapes. The only behavior moved up to this layer is `probeLogMeta`,
 * which used to live inline in `App.tsx`. Lifting it here means the Plan
 * 11-03 webview client can implement the same probe over postMessage
 * without duplicating App startup logic.
 */

import { apiUrl } from "./api-base.js";
import type { AhpViewerClient, LogMetaProbeResult, LogStreamHandle } from "./client.js";
import { fetchEvent } from "./http-client.js";
import { searchEvents } from "./search-client.js";
import { fetchCandidates, openSessionByCandidate, openSessionByPath } from "./sessions-client.js";
import { connectLogStream } from "./sse-client.js";
import { fetchStateAt } from "./state-client.js";

async function probeLogMeta(): Promise<LogMetaProbeResult> {
  let resp: Response;
  try {
    resp = await fetch(apiUrl("/api/log/meta"));
  } catch {
    return "no-server";
  }
  if (resp.status === 204) return "no-log";
  const contentType = resp.headers.get("content-type") ?? "";
  if (!resp.ok || !contentType.toLowerCase().includes("application/json")) {
    return "no-server";
  }
  return "ready";
}

export function createBrowserAhpViewerClient(): AhpViewerClient {
  return {
    probeLogMeta,
    fetchCandidates,
    openSessionByCandidate,
    openSessionByPath,
    connectLogStream(): LogStreamHandle {
      return connectLogStream();
    },
    fetchEvent,
    searchEvents,
    fetchStateAt,
  };
}
