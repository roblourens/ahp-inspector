import { type FormEvent, type JSX, useId, useState } from "react";
import { ERROR_COPY, FALLBACK_ERROR, getOpenErrorMessage } from "./error-copy.js";

const MAX_PATH_LEN = 4096;

export function ManualOpenInput({
  onOpen,
  disabled,
}: {
  onOpen(path: string): Promise<void>;
  disabled?: boolean;
}): JSX.Element {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy || disabled) return;
    setError(null);
    if (path.length === 0) return;
    if (path.length > MAX_PATH_LEN) {
      setError(ERROR_COPY["path-too-long"] ?? FALLBACK_ERROR);
      return;
    }
    setBusy(true);
    try {
      await onOpen(path);
    } catch (err) {
      setError(getOpenErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
      aria-label="Open log by path"
    >
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          maxLength={MAX_PATH_LEN}
          placeholder="Paste a log file path"
          disabled={disabled || busy}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          style={{
            flex: 1,
            height: 32,
            padding: "0 var(--space-3)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            color: "var(--color-text)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-row-size)",
          }}
        />
        <button
          type="submit"
          disabled={disabled || busy || path.length === 0}
          style={{
            height: 32,
            padding: "0 var(--space-4)",
            background: "var(--color-accent)",
            border: "none",
            borderRadius: 4,
            color: "var(--color-bg)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {busy ? "Opening…" : "Open Log"}
        </button>
      </div>
      {error !== null && (
        <div
          id={errorId}
          role="alert"
          style={{
            color: "var(--color-destructive)",
            fontSize: "var(--text-body-size)",
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
