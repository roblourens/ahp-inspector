import type { Direction } from "@ahp-inspector/shared";

export interface WireMeta {
  readonly ts: number;
  readonly tsRaw: string;
  readonly dir: Direction | null;
}

/**
 * Extract the AHP `_ahpLog` sidecar (real wire timestamp + direction) from a
 * parsed JSONL payload. Returns null when the field is absent or malformed —
 * caller falls back to ingest time + structural direction inference.
 */
export function extractWireMeta(raw: unknown): WireMeta | null {
  if (raw === null || typeof raw !== "object") return null;
  const log = (raw as { _ahpLog?: unknown })._ahpLog;
  if (log === null || typeof log !== "object") return null;
  const tsField = (log as { ts?: unknown }).ts;
  if (typeof tsField !== "string" || tsField.length === 0) return null;
  const parsedTs = Date.parse(tsField);
  if (!Number.isFinite(parsedTs)) return null;
  const dirField = (log as { dir?: unknown }).dir;
  const dir: Direction | null = dirField === "c2s" || dirField === "s2c" ? dirField : null;
  return { ts: parsedTs, tsRaw: tsField, dir };
}
