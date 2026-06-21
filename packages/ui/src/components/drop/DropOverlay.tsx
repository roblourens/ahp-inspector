// DropOverlay — visual contract per 17-UI-SPEC.md (CONTEXT D-03).

import { type JSX, useEffect } from "react";
import { Z } from "../../styles/zLayers.js";

export type DropOverlayState =
  | { kind: "idle" }
  | { kind: "armed"; replacing: boolean }
  | { kind: "error"; message: string };

const ARMED_HEADING = "Drop a .jsonl file to open.";
const ARMED_BODY = "Drag from Finder, Explorer, or VS Code's file tree.";
const REPLACING_HEADING = "Drop to replace the active log.";
const REPLACING_BODY = "The current log will close and the new file will start tailing.";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function DropOverlay(props: {
  state: DropOverlayState;
  onDismiss: () => void;
}): JSX.Element | null {
  const { state, onDismiss } = props;

  useEffect(() => {
    if (state.kind !== "error") return;
    function handler(event: KeyboardEvent): void {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [state.kind, onDismiss]);

  if (state.kind === "idle") return null;

  const isError = state.kind === "error";
  const borderColor = isError ? "var(--color-destructive)" : "var(--color-accent)";

  const scrimStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: Z.controls,
    background: "color-mix(in srgb, var(--color-bg) 80%, transparent)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "35vh",
    transition: REDUCED_MOTION ? undefined : "opacity 150ms",
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 480,
    width: "100%",
    marginInline: "auto",
    padding: "var(--space-4) var(--space-5)",
    background: "var(--color-surface-raised)",
    border: `2px dashed ${borderColor}`,
    borderRadius: 4,
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
  };

  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "var(--text-heading-size)",
    fontWeight: "var(--weight-semibold)",
    lineHeight: 1.4,
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
  };

  const bodyStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "var(--text-body-size)",
    lineHeight: 1.45,
    color: "var(--color-text-muted)",
    fontFamily: "var(--font-sans)",
  };

  const errorTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "var(--text-body-size)",
    lineHeight: 1.45,
    color: "var(--color-destructive)",
    fontFamily: "var(--font-sans)",
  };

  const dismissButtonStyle: React.CSSProperties = {
    alignSelf: "flex-start",
    height: 32,
    padding: "0 var(--space-4)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 4,
    color: "var(--color-text)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-ui-size)",
    cursor: "pointer",
  };

  let inner: JSX.Element;
  if (state.kind === "armed") {
    const heading = state.replacing ? REPLACING_HEADING : ARMED_HEADING;
    const body = state.replacing ? REPLACING_BODY : ARMED_BODY;
    inner = (
      <div aria-live="polite">
        <h2 style={headingStyle}>{heading}</h2>
        <p style={bodyStyle}>{body}</p>
      </div>
    );
  } else {
    inner = (
      <div aria-live="polite">
        <p role="alert" style={errorTextStyle}>
          {state.message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          style={{ ...dismissButtonStyle, marginTop: "var(--space-3)" }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Drop a log file" style={scrimStyle}>
      <div style={cardStyle}>{inner}</div>
    </section>
  );
}
