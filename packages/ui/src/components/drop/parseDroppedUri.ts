// Implements CONTEXT D-02 (text/uri-list first, friendly error otherwise) and D-04 (first .jsonl wins).

export type ParseResult =
  | { kind: "ok"; path: string; ignoredCount: number }
  | { kind: "error"; code: "no-uri" | "not-jsonl" };

export function parseDroppedUri(dataTransfer: Pick<DataTransfer, "getData">): ParseResult {
  const raw = dataTransfer.getData("text/uri-list");
  if (!raw || raw.trim() === "") {
    return { kind: "error", code: "no-uri" };
  }

  const entries: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("#")) continue;
    entries.push(trimmed);
  }

  if (entries.length === 0) {
    return { kind: "error", code: "no-uri" };
  }

  let ignoredCount = 0;
  for (const entry of entries) {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      ignoredCount++;
      continue;
    }
    if (url.protocol !== "file:") {
      ignoredCount++;
      continue;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      ignoredCount++;
      continue;
    }
    if (!decoded.toLowerCase().endsWith(".jsonl")) {
      ignoredCount++;
      continue;
    }
    return { kind: "ok", path: decoded, ignoredCount };
  }

  return { kind: "error", code: "not-jsonl" };
}
