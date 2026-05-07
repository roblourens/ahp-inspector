// biome-ignore-all lint/a11y/useSemanticElements: virtualized grid uses divs for absolute positioning.

import { AlertTriangle } from "lucide-react";
import type { CSSProperties, JSX } from "react";

export interface GapBannerRowProps {
  prev: number;
  curr: number;
  virtualStyle: CSSProperties;
}

export function GapBannerRow({ prev, curr, virtualStyle }: GapBannerRowProps): JSX.Element {
  const missing = curr - prev - 1;
  const ariaLabel = `Server sequence gap of ${missing} events between ${prev} and ${curr}`;

  return (
    <div
      role="row"
      aria-label={ariaLabel}
      data-testid="gap-banner"
      // biome-ignore lint/a11y/useFocusableInteractive: grid row managed by keyboard handler in TimelineRegion
      tabIndex={-1}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "var(--row-banner-height)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        background: "var(--color-gap-banner-bg)",
        color: "var(--color-gap-banner-fg)",
        fontSize: "var(--text-ui-muted-size)",
        fontFamily: "var(--font-mono)",
        ...virtualStyle,
      }}
    >
      <AlertTriangle size={12} aria-hidden="true" />
      <span>{`serverSeq gap: ${prev} → ${curr} (missing ${missing})`}</span>
    </div>
  );
}
