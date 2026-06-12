import type { CSSProperties } from "react";

export function popoverPosition(anchorName: string, align: "start" | "end"): CSSProperties {
  if (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("anchor-name: --ahp-popover-anchor")
  ) {
    return {
      position: "fixed",
      positionAnchor: anchorName,
      top: "anchor(bottom)",
      marginTop: 4,
      ...(align === "start" ? { left: "anchor(left)" } : { right: "anchor(right)" }),
    };
  }

  return {
    position: "absolute",
    top: "calc(100% + 4px)",
    ...(align === "start" ? { left: 0 } : { right: 0 }),
  };
}
