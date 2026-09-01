/**
 * RawJsonView — renders JSON as plain text in a <pre> element.
 *
 * T-03-04-01 / T-34-01: React auto-escapes text children and the shared
 * highlighter only emits escaped React nodes plus <mark> — raw HTML is never
 * injected. This is the safe rendering guarantee for arbitrary event payloads.
 *
 * No raw #hex literals.
 */
import type { JSX } from "react";
import { HighlightedText } from "../timeline/cells/highlight.js";
import { prepareJson } from "./json-display.js";

interface RawJsonViewProps {
  data: unknown;
  query?: string;
}

export function RawJsonView({ data, query }: RawJsonViewProps): JSX.Element {
  const text = prepareJson(data).prettyText;

  return (
    <pre
      data-testid="raw-json-view"
      style={{
        margin: 0,
        padding: "var(--space-2) var(--space-3)",
        overflow: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-ui-muted-size)",
        color: "var(--color-text)",
        flex: 1,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      <HighlightedText text={text} query={query ?? ""} />
    </pre>
  );
}
