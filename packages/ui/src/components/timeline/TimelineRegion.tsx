import type { JSX } from "react";

/**
 * Stub: real virtualized timeline replaces this in Plan 02-04.
 * Keeps AppShell mountable and supplies the flex container for the timeline region.
 */
export function TimelineRegion(): JSX.Element {
  return (
    <div
      data-testid="timeline-region"
      style={{ flex: 1, minHeight: 0, minWidth: 0, background: "var(--color-bg)" }}
    />
  );
}
