/**
 * DetailResizeHandle — 4px hit area on the left edge of the detail panel.
 *
 * Mouse drag: onMouseDown → track clientX delta → call onResize(newWidth).
 * Keyboard: Left/Right arrows add/subtract 16px increments.
 * Bounds: clamped to [min, max] (defaults: [360, 720]).
 *
 * No raw #hex literals.
 */
import type { JSX, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useRef } from "react";
import { Z } from "../../styles/zLayers.js";
import { DETAIL_KEYBOARD_STEP } from "./detail-layout.js";

interface DetailResizeHandleProps {
  width: number;
  onResize(px: number): void;
  min: number;
  max: number;
}

export function DetailResizeHandle({
  width,
  onResize,
  min,
  max,
}: DetailResizeHandleProps): JSX.Element {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const moveHandler = useRef<((ev: globalThis.MouseEvent) => void) | null>(null);
  const upHandler = useRef<(() => void) | null>(null);

  function clamp(v: number): number {
    return Math.max(min, Math.min(max, v));
  }

  const stopDrag = useCallback(() => {
    dragging.current = false;
    if (moveHandler.current) {
      document.removeEventListener("mousemove", moveHandler.current);
      moveHandler.current = null;
    }
    if (upHandler.current) {
      document.removeEventListener("mouseup", upHandler.current);
      upHandler.current = null;
    }
  }, []);

  useEffect(() => stopDrag, [stopDrag]);

  function handleMouseDown(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    stopDrag();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    function onMouseMove(ev: globalThis.MouseEvent) {
      if (!dragging.current) return;
      const delta = startX.current - ev.clientX;
      onResize(clamp(startWidth.current + delta));
    }

    function onMouseUp() {
      stopDrag();
    }

    moveHandler.current = onMouseMove;
    upHandler.current = onMouseUp;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onResize(clamp(width + DETAIL_KEYBOARD_STEP));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onResize(clamp(width - DETAIL_KEYBOARD_STEP));
    }
  }

  return (
    <button
      type="button"
      data-testid="detail-resize-handle"
      aria-label="Resize detail panel"
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "4px",
        cursor: "col-resize",
        background: "transparent",
        border: "none",
        padding: 0,
        zIndex: Z.sticky,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background =
          "color-mix(in srgb, var(--color-accent) 60%, transparent)";
      }}
      onMouseLeave={(e) => {
        if (!dragging.current) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    />
  );
}
