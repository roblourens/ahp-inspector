/**
 * RawJsonView — renders JSON as plain text in a <pre> element.
 *
 * T-03-04-01: React auto-escapes text children — NO dangerouslySetInnerHTML.
 * This is the safe rendering guarantee for arbitrary event payloads.
 *
 * No raw #hex literals.
 */
import type { JSX } from "react";

interface RawJsonViewProps {
  data: unknown;
  query?: string;
}

export function RawJsonView({ data }: RawJsonViewProps): JSX.Element {
  const text = (() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return "[Circular or non-serializable value]";
    }
  })();

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
      {text}
    </pre>
  );
}
