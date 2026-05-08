import { Loader2 } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { fetchStateAt, type StateAtSuccessResponse } from "../../transport/state-client.js";

interface StateInspectorPanelProps {
  readonly idx: number;
  readonly logKey: string | null;
}

type LoadState =
  | { readonly status: "idle"; readonly data: null; readonly error: null }
  | { readonly status: "loading"; readonly data: null; readonly error: null }
  | { readonly status: "error"; readonly data: null; readonly error: string }
  | { readonly status: "ok"; readonly data: StateAtSuccessResponse; readonly error: null };

const IDLE_STATE: LoadState = { status: "idle", data: null, error: null };

export function StateInspectorPanel({ idx, logKey }: StateInspectorPanelProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>(IDLE_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const requestKey = `${idx}\u0000${logKey ?? ""}`;
  const lastRequestKeyRef = useRef(requestKey);

  const loadMetadata = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadState({ status: "loading", data: null, error: null });

    try {
      const data = await fetchStateAt(idx, { logKey, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (data === null) {
        setLoadState({
          status: "error",
          data: null,
          error: `Event #${idx} not found while loading reconstructed state.`,
        });
      } else {
        setLoadState({ status: "ok", data, error: null });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      setLoadState({ status: "error", data: null, error: message });
    }
  }, [idx, logKey]);

  useEffect(() => {
    if (lastRequestKeyRef.current === requestKey) return;
    lastRequestKeyRef.current = requestKey;
    setOpen(false);
    setLoadState(IDLE_STATE);
    if (abortRef.current) abortRef.current.abort();
  }, [requestKey]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function handleOpen(): void {
    setOpen((current) => {
      if (!current) void loadMetadata();
      return !current;
    });
  }

  function handleRetry(): void {
    void loadMetadata();
  }

  return (
    <section
      data-testid="state-inspector-panel"
      aria-label="Reconstructed state inspector"
      style={{
        borderTop: "1px solid var(--color-border)",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-3)",
        background: "var(--color-surface-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: "var(--color-text)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-size)",
              fontWeight: "var(--weight-semibold)",
            }}
          >
            Reconstructed state
          </h3>
          <p
            style={{
              margin: "var(--space-1) 0 0",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-ui-muted-size)",
            }}
          >
            Replay reducer state at event #{idx}.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          aria-expanded={open}
          style={{
            flex: "0 0 auto",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-raised)",
            color: "var(--color-text)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-size)",
            padding: "var(--space-2) var(--space-3)",
          }}
        >
          State at this point
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: "var(--space-3)",
            color: "var(--color-text)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-ui-size)",
          }}
        >
          {loadState.status === "loading" && (
            <div
              data-testid="state-inspector-loading"
              style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
            >
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              Loading reconstructed state metadata…
            </div>
          )}

          {loadState.status === "error" && (
            <div data-testid="state-inspector-error">
              <p style={{ margin: "0 0 var(--space-2)", color: "var(--color-destructive)" }}>
                {loadState.error}
              </p>
              <button
                type="button"
                onClick={handleRetry}
                style={{
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-raised)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-ui-size)",
                  padding: "var(--space-1) var(--space-2)",
                }}
              >
                Retry state lookup
              </button>
            </div>
          )}

          {loadState.status === "ok" && <StateMetadataSummary data={loadState.data} />}
        </div>
      )}
    </section>
  );
}

function StateMetadataSummary({ data }: { readonly data: StateAtSuccessResponse }): JSX.Element {
  return (
    <div data-testid="state-inspector-metadata">
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "var(--space-1) var(--space-3)",
          margin: 0,
        }}
      >
        <dt style={{ color: "var(--color-text-muted)" }}>Target</dt>
        <dd style={{ margin: 0 }}>#{data.targetIndex}</dd>
        <dt style={{ color: "var(--color-text-muted)" }}>Confidence</dt>
        <dd style={{ margin: 0 }}>{data.confidence}</dd>
        <dt style={{ color: "var(--color-text-muted)" }}>Resources</dt>
        <dd style={{ margin: 0 }}>{data.resources.length}</dd>
      </dl>
      <p
        style={{
          margin: "var(--space-2) 0 0",
          color: "var(--color-text-muted)",
          fontSize: "var(--text-ui-muted-size)",
        }}
      >
        Resource metadata loaded. Selecting a resource in the next step loads its full state.
      </p>
    </div>
  );
}
