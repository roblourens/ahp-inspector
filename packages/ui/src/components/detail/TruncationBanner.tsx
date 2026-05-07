/**
 * TruncationBanner — warning shown when payload exceeds 256KB or is server-truncated.
 *
 * No raw #hex literals; uses CSS variable color-mix pattern from tokens.css.
 */

import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

interface TruncationBannerProps {
  kind: "client-cap" | "server-cap";
  bytes?: number;
  onOpenRaw?(): void;
  onCopyFull?(): void;
}

export function TruncationBanner({
  kind,
  bytes,
  onOpenRaw,
  onCopyFull,
}: TruncationBannerProps): JSX.Element {
  return (
    <div
      data-testid="truncation-banner"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        background: "color-mix(in srgb, var(--color-warning) 14%, var(--color-bg))",
        color: "var(--color-warning)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
      <div>
        {kind === "client-cap" ? (
          <>
            Tree view truncated at 256 KB to keep the UI responsive.{" "}
            {onOpenRaw && (
              <button
                type="button"
                onClick={onOpenRaw}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-warning)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontSize: "inherit",
                  fontFamily: "inherit",
                }}
              >
                [Open Raw]
              </button>
            )}
            {onOpenRaw && onCopyFull && " "}
            {onCopyFull && (
              <button
                type="button"
                onClick={onCopyFull}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-warning)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  fontSize: "inherit",
                  fontFamily: "inherit",
                }}
              >
                [Copy full payload]
              </button>
            )}
          </>
        ) : (
          `Payload truncated at ${bytes != null ? Math.round(bytes / 1024) : "?"} KB.`
        )}
      </div>
    </div>
  );
}
