import type { Direction } from "@ahp-viewer/shared";
import type { JSX } from "react";

// Plan 02-03 deviation (Rule 3): the canonical `Direction` from
// @ahp-viewer/shared is "c2s" | "s2c". The plan called for an "unknown"
// fallback glyph (UI-SPEC §5.1). We widen the cell prop locally to keep
// the renderer total without changing the shared type.
export type DirectionInput = Direction | "unknown";

const GLYPH: Record<DirectionInput, string> = {
  c2s: "→",
  s2c: "←",
  unknown: "·",
};
const COLOR: Record<DirectionInput, string> = {
  c2s: "var(--dir-c2s)",
  s2c: "var(--dir-s2c)",
  unknown: "var(--color-text-muted)",
};

export function DirectionGlyph({ direction }: { direction: DirectionInput }): JSX.Element {
  return (
    <span
      data-testid="dir-glyph"
      data-direction={direction}
      style={{
        display: "inline-block",
        width: 16,
        textAlign: "center",
        color: COLOR[direction],
      }}
    >
      {GLYPH[direction]}
    </span>
  );
}
