// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid uses divs for absolute positioning.

import { ChevronDown, ChevronRight } from "lucide-react";
import type { CSSProperties, JSX } from "react";

export interface GroupHeaderRowProps {
  level: "session" | "turn";
  sessionId: string;
  turnId?: string;
  count: number;
  durationMs: number;
  isCollapsed: boolean;
  onToggle(): void;
  virtualStyle: CSSProperties;
}

function formatDuration(ms: number): string {
  if (ms < 50) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function GroupHeaderRow({
  level,
  sessionId,
  turnId,
  count,
  durationMs,
  isCollapsed,
  onToggle,
  virtualStyle,
}: GroupHeaderRowProps): JSX.Element {
  const label =
    level === "session" ? `Session ${sessionId.slice(-8)}` : `↳ Turn ${(turnId ?? "").slice(-6)}`;

  const ariaLabel = isCollapsed ? `Expand ${label}` : `Collapse ${label}`;

  return (
    <div
      role="row"
      data-testid={`group-header-${level}`}
      // biome-ignore lint/a11y/useFocusableInteractive: grid row managed by keyboard handler in TimelineRegion
      tabIndex={-1}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "var(--row-group-header-height)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        paddingLeft: level === "turn" ? "var(--space-5)" : "var(--space-3)",
        paddingRight: "var(--space-3)",
        background: "var(--color-group-header-bg)",
        color: "var(--color-group-header-fg)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-sans)",
        userSelect: "none",
        ...virtualStyle,
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onToggle}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-group-header-fg)",
          display: "flex",
          alignItems: "center",
          padding: 0,
          flexShrink: 0,
        }}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      <span
        style={{ flex: 1, fontWeight: "var(--weight-semibold)" as CSSProperties["fontWeight"] }}
      >
        {label}
      </span>
      <span style={{ color: "var(--color-group-header-meta)", flexShrink: 0 }}>
        {count} {count === 1 ? "event" : "events"} · {formatDuration(durationMs)}
      </span>
    </div>
  );
}
